/**
 * Trinks Sync Worker (Story 1.6) — popula trinks_appointments a partir da API Trinks.
 *
 * Decisões (story 1.6, validadas com Victor):
 *   • Mora na imagem do BACKEND (reusa db.js + padrão Trinks); roda como container
 *     isolado `admin-trinks-sync` (command override) — isolamento de crash.
 *   • Sem node-cron: setInterval (dep-free). Roda 1x no boot + a cada 15min.
 *
 * Realidade da API (Fase 0):
 *   • Filtro do range é por dataHoraInicio (scheduled_at), NÃO por criação do booking.
 *     → "incremental" = re-puxar janela móvel (pega novos bookings + mudanças de status).
 *   • Sem data de criação → created_at_trinks NULL. Métricas keyed em scheduled_at.
 *   • Telefone só via /clientes/:id → resolvido com cache, teto por ciclo.
 */

const db = require('./db');
const { listAgendamentosPage, getClientePhone } = require('./lib/trinks-client');
const { mapAppointment, normalizePhoneBR } = require('./lib/trinks-mapping');

// Frequência do reconcile. ERA 15min (96×/dia × ~19 págs ≈ 55k chamadas/mês = 11× o limite Trinks de 5.000/mês).
// Default agora 6h (4×/dia) como medida imediata de consumo; estado-final = webhooks em tempo real + reconcile diário.
// Configurável via env TRINKS_SYNC_INTERVAL_MIN.
const SYNC_INTERVAL_MS = (parseInt(process.env.TRINKS_SYNC_INTERVAL_MIN || '360', 10)) * 60 * 1000;
const BR_OFFSET = '-03:00'; // Brasil sem DST desde 2019; dataHoraInicio é local naive
const MAX_NEW_CLIENT_LOOKUPS = 500; // teto de /clientes por ciclo (resto preenche nos próximos)
const PAGE_SLEEP_MS = 600; // pausa entre páginas (rate limit Trinks; 429 tem backoff próprio)

const log = (msg, extra) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), worker: 'trinks-sync', msg, ...extra }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysAhead = (n) => new Date(Date.now() + n * 86400000);

/** dataHoraInicio naive ("2026-05-28T19:30:00") → timestamptz com offset BR. */
function toTimestamptz(s) {
  if (typeof s !== 'string') return s;
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}${BR_OFFSET}`;
}

async function readSyncState() {
  const r = await db.query('SELECT * FROM trinks_sync_state WHERE id = 1');
  return r?.rows?.[0] ?? null;
}

/** Janela a sincronizar: backfill amplo no 1º run, janela móvel depois. */
function syncWindow(state) {
  if (!state || !state.last_success_at) {
    // Backfill one-time: 90d atrás → 7d à frente.
    return { dataInicio: fmtDate(daysAgo(90)), dataFim: fmtDate(daysAhead(7)), mode: 'backfill' };
  }
  // Incremental leve (a cada 15min): janela curta pega novos bookings + mudanças de status
  // recentes sem martelar a Trinks. Histórico antigo já está sincronizado pelo backfill.
  return { dataInicio: fmtDate(daysAgo(10)), dataFim: fmtDate(daysAhead(10)), mode: 'incremental' };
}

/** Seed do cache de telefones a partir do que já está no banco (evita re-lookup). */
async function loadPhoneCache() {
  const cache = new Map();
  const r = await db.query(
    `SELECT DISTINCT client_trinks_id, client_phone FROM trinks_appointments
     WHERE client_trinks_id IS NOT NULL AND client_phone IS NOT NULL`,
  );
  for (const row of r?.rows ?? []) cache.set(String(row.client_trinks_id), row.client_phone);
  return cache;
}

/** Resolve telefone (normalizado) por cliente, usando cache + teto de lookups. */
async function resolvePhones(records, cache, remainingCap = MAX_NEW_CLIENT_LOOKUPS) {
  let lookups = 0;
  for (const rec of records) {
    const cid = rec.cliente?.id != null ? String(rec.cliente.id) : null;
    if (!cid || cache.has(cid)) continue;
    if (lookups >= remainingCap) break; // teto global do ciclo atingido
    try {
      const raw = await getClientePhone(cid);
      cache.set(cid, normalizePhoneBR(raw)); // pode ser null — cacheia mesmo assim p/ não repetir
      lookups++;
    } catch (err) {
      log('cliente_lookup_failed', { cid, error: err.message });
    }
  }
  return lookups;
}

const COLS = [
  'trinks_id', 'client_trinks_id', 'client_phone', 'client_name',
  'professional_id', 'professional_name', 'service_id', 'service_name',
  'status', 'scheduled_at', 'duration_min', 'price_cents',
  'created_at_trinks', 'updated_at_trinks', 'cancelled_at', 'no_show_at', 'raw',
];

async function upsertChunk(rows) {
  if (!rows.length) return 0;
  const values = [];
  const tuples = rows.map((row, i) => {
    const base = i * COLS.length;
    const ph = COLS.map((_, j) => `$${base + j + 1}`);
    values.push(
      row.trinks_id, row.client_trinks_id, row.client_phone, row.client_name,
      row.professional_id, row.professional_name, row.service_id, row.service_name,
      row.status, toTimestamptz(row.scheduled_at), row.duration_min, row.price_cents,
      row.created_at_trinks, row.updated_at_trinks, row.cancelled_at, row.no_show_at,
      JSON.stringify(row.raw),
    );
    return `(${ph.join(',')})`;
  });
  // Em UPDATE, não sobrescreve phone com NULL (preserva o já resolvido).
  const updates = COLS.filter((c) => c !== 'trinks_id')
    .map((c) => (c === 'client_phone'
      ? `client_phone = COALESCE(EXCLUDED.client_phone, trinks_appointments.client_phone)`
      : `${c} = EXCLUDED.${c}`))
    .join(', ');
  const sql = `INSERT INTO trinks_appointments (${COLS.join(',')})
    VALUES ${tuples.join(',')}
    ON CONFLICT (trinks_id) DO UPDATE SET ${updates}, synced_at = NOW()`;
  const res = await db.query(sql, values);
  return res ? rows.length : 0;
}

async function runCycle() {
  const state = await readSyncState();
  const win = syncWindow(state);
  log('cycle_start', win);
  try {
    const cache = await loadPhoneCache();
    let page = 1;
    let totalPages = 1;
    let synced = 0;
    let lookups = 0;

    // Paginação com UPSERT por página: cada página persiste imediatamente, então
    // um 429/erro numa página tardia NÃO descarta as anteriores (resiliente).
    do {
      const p = await listAgendamentosPage({ dataInicio: win.dataInicio, dataFim: win.dataFim, page });
      totalPages = p.totalPages || 1;

      lookups += await resolvePhones(p.data, cache, MAX_NEW_CLIENT_LOOKUPS - lookups);

      const rows = p.data
        .map((rec) => {
          const cid = rec.cliente?.id != null ? String(rec.cliente.id) : null;
          return mapAppointment(rec, cid ? cache.get(cid) ?? null : null);
        })
        .filter(Boolean);

      synced += await upsertChunk(rows);
      await db.query('UPDATE trinks_sync_state SET last_sync_at = NOW() WHERE id = 1');

      page += 1;
      if (page <= totalPages) await sleep(PAGE_SLEEP_MS);
    } while (page <= totalPages);

    await db.query(
      `UPDATE trinks_sync_state
       SET last_success_at = NOW(), consecutive_failures = 0, last_error = NULL,
           records_synced_total = records_synced_total + $1
       WHERE id = 1`,
      [synced],
    );
    log('cycle_ok', { synced, pages: totalPages, new_client_lookups: lookups, mode: win.mode });
  } catch (err) {
    await db.query(
      `UPDATE trinks_sync_state
       SET last_sync_at = NOW(), consecutive_failures = consecutive_failures + 1, last_error = $1
       WHERE id = 1`,
      [String(err.message).slice(0, 500)],
    );
    log('cycle_error', { error: err.message });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    log('fatal', { error: 'DATABASE_URL ausente' });
    process.exit(1);
  }
  log('boot', { interval_min: SYNC_INTERVAL_MS / 60000 });
  await runCycle();
  setInterval(() => {
    runCycle().catch((err) => log('cycle_unhandled', { error: err.message }));
  }, SYNC_INTERVAL_MS);
}

// Só executa se rodado diretamente (não em require de teste).
if (require.main === module) {
  main().catch((err) => {
    log('fatal', { error: err.message });
    process.exit(1);
  });
}

module.exports = { syncWindow, toTimestamptz, upsertChunk, resolvePhones, runCycle, COLS };
