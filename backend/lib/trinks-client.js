/**
 * Trinks API client (Story 1.6 — usado pelo trinks-sync-worker).
 *
 * Standalone de propósito: o worker roda como processo/container separado e NÃO
 * importa server.js (hot-path do bot). Reusa os MESMOS env vars e o mesmo padrão
 * de headers do server.js:fetchTrinks (X-Api-Key + estabelecimentoId).
 *
 * Endpoints confirmados na Fase 0:
 *   GET /agendamentos?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&page=N  (paginado, page=1..totalPages)
 *   GET /clientes/:id  → { telefone, ... }
 */

const TRINKS_API_BASE = (process.env.TRINKS_API_BASE || 'https://api.trinks.com/v1').replace(/\/$/, '');
const TRINKS_KEY = process.env.TRINKS_API_KEY;
const TRINKS_EST_ID = process.env.TRINKS_ESTABELECIMENTO_ID || '243868';
const TIMEOUT_MS = 12_000;

async function fetchTrinks(path) {
  const res = await fetch(`${TRINKS_API_BASE}${path}`, {
    headers: { 'X-Api-Key': TRINKS_KEY, estabelecimentoId: String(TRINKS_EST_ID) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Trinks ${res.status}: ${path}`);
  return res.json();
}

/** Uma página de agendamentos no range [dataInicio, dataFim] (datas YYYY-MM-DD). */
async function listAgendamentosPage({ dataInicio, dataFim, page = 1 }) {
  const json = await fetchTrinks(
    `/agendamentos?dataInicio=${dataInicio}&dataFim=${dataFim}&page=${page}`,
  );
  return {
    data: Array.isArray(json.data) ? json.data : [],
    page: json.page ?? page,
    totalPages: json.totalPages ?? 1,
    totalRecords: json.totalRecords ?? null,
  };
}

/**
 * Todos os agendamentos do range, paginando por `page`. Sleep entre páginas pra
 * respeitar rate limit (arch §18). maxPages é um teto de segurança.
 */
async function listAllAgendamentos({ dataInicio, dataFim, sleepMs = 250, maxPages = 200 }) {
  const all = [];
  const first = await listAgendamentosPage({ dataInicio, dataFim, page: 1 });
  all.push(...first.data);
  const totalPages = Math.min(first.totalPages || 1, maxPages);
  for (let page = 2; page <= totalPages; page++) {
    await sleep(sleepMs);
    const p = await listAgendamentosPage({ dataInicio, dataFim, page });
    all.push(...p.data);
  }
  return all;
}

/** Telefone bruto de um cliente (string) ou null. */
async function getClientePhone(clienteId) {
  if (clienteId == null) return null;
  const json = await fetchTrinks(`/clientes/${clienteId}`);
  const c = json?.data ?? json;
  return c?.telefone ?? null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { fetchTrinks, listAgendamentosPage, listAllAgendamentos, getClientePhone, TRINKS_API_BASE };
