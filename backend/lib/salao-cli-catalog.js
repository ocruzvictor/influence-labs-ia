/**
 * Catálogo / FAQ / cancel / backlog — CLIs 0-LLM. Sem Tess, sem Trinks mutate.
 */

const fs = require('fs');
const path = require('path');
const {
  filterServicesByKeywords,
  formatServiceCatalogLine,
  resolveCancelAgendamentoId,
} = require('./booking-parser');
const { last4FromPhone, normalizeLast4, redactSnippet } = require('./nightwatch-ops');
const { createTrinksLocalStore } = require('./trinks-local-store');

const NEVER_RESUME = Object.freeze(['0007', '8440', '0101', '8194']);
const CANDIDATA_PENDENTE = Object.freeze([
  '6388', '7504', '9002', '6932', '5953', '9800', '9117', '5031',
  '4467', '7625', '6397', '2062', '7051', '1000', '4657', '6361',
]);
const REVISAO_MANUAL = Object.freeze([
  '3653', '8290', '3300', '8085', '7153', '7016', '6153', '8741', '1944',
]);

const FAQ_FILE = path.join(__dirname, '..', '..', 'data', 'kb', 'conversa-v2', 'info-estatica.md');

const FAQ_ALIASES = {
  endereco: ['endereco', 'endereço', 'onde fica', 'como chegar', 'maps'],
  estacionamento: ['estacionamento', 'estacionar', 'rampa'],
  pix: ['pix', 'pagamento', 'pagar', 'cartao', 'cartão', 'dinheiro'],
  funcionamento: ['funcionamento', 'horario', 'horário', 'abre', 'fecha', 'expediente'],
};

function mapServiceRow(row) {
  return {
    id: row.trinks_id || row.id,
    nome: row.name || row.nome,
    duracaoEmMinutos: row.duration_min || row.duracaoEmMinutos,
    preco: row.price_cents != null ? Number(row.price_cents) / 100 : Number(row.preco || 0),
    profissionais: row.profissionais || [],
  };
}

function consultarPrecoServico({ termo, services = [] }) {
  const list = Array.isArray(services) ? services.map(mapServiceRow) : [];
  const filtered = filterServicesByKeywords(list, termo);
  if (!filtered || !filtered.length) {
    return { status: 'vazio', termo: String(termo || ''), items: [] };
  }
  const items = filtered.slice(0, 12).map((s) => ({
    id: s.id,
    nome: s.nome,
    preco: s.preco,
    line: formatServiceCatalogLine(s),
  }));
  return {
    status: items.length > 5 ? 'ambiguo' : 'ok',
    termo: String(termo || ''),
    items,
  };
}

async function consultarPrecoServicoLive(db, { termo }) {
  const store = createTrinksLocalStore(db);
  const rows = await store.listServices();
  return consultarPrecoServico({ termo, services: rows || [] });
}

function resolveFaqKey(termo) {
  const norm = String(termo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  for (const [key, aliases] of Object.entries(FAQ_ALIASES)) {
    if (key === norm || aliases.some((a) => norm.includes(a))) return key;
  }
  return null;
}

function consultarFaqEstatica({ termo, markdown } = {}) {
  const key = resolveFaqKey(termo);
  let text = markdown;
  if (text == null) {
    try {
      text = fs.readFileSync(FAQ_FILE, 'utf8');
    } catch {
      return { status: 'nao_encontrado', key, trecho: null };
    }
  }
  const sections = {
    endereco: extractSection(text, '## Identidade'),
    funcionamento: extractSection(text, '## Horario de Funcionamento'),
    pix: extractSection(text, '## Formas de Pagamento'),
    estacionamento: extractLine(text, 'Estacionamento'),
  };
  if (!key || !sections[key]) {
    return { status: 'nao_encontrado', key, trecho: null };
  }
  return { status: 'ok', key, trecho: sections[key].trim() };
}

function extractSection(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start < 0) return '';
  const rest = markdown.slice(start);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

function extractLine(markdown, label) {
  const line = String(markdown || '').split('\n').find((l) => l.includes(label));
  return line || '';
}

function resolverIdCancelamento({ id, futureBookings = [], knownServiceIds = [] }) {
  return resolveCancelAgendamentoId({
    cancelTag: { agendamento_id: id },
    futureBookings,
    knownServiceIds,
  });
}

function staticCategory(last4) {
  if (NEVER_RESUME.includes(last4)) return 'NÃO RETOMAR';
  if (CANDIDATA_PENDENTE.includes(last4)) return 'CANDIDATA_PENDENTE';
  if (REVISAO_MANUAL.includes(last4)) return 'REVISÃO_MANUAL';
  return 'FORA_DA_LISTA';
}

async function triarBacklogLast4(db, { last4s } = {}) {
  const requested = Array.isArray(last4s) && last4s.length
    ? last4s.map(normalizeLast4).filter(Boolean)
    : [...CANDIDATA_PENDENTE, ...REVISAO_MANUAL, ...NEVER_RESUME];
  const result = await db.query(
    `SELECT DISTINCT ON (RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4))
            client_phone, role, content, created_at
       FROM conversation_history
      WHERE RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = ANY($1::text[])
      ORDER BY RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4), created_at DESC`,
    [requested],
  );
  const byLast4 = new Map();
  for (const row of result?.rows || []) {
    byLast4.set(last4FromPhone(row.client_phone), row);
  }
  const items = requested.map((last4) => {
    const dossier = staticCategory(last4);
    const row = byLast4.get(last4);
    const lastRole = row ? row.role : null;
    let atual = dossier;
    if (NEVER_RESUME.includes(last4)) atual = 'NÃO RETOMAR';
    else if (lastRole === 'user') atual = 'CANDIDATA_PENDENTE';
    else if (lastRole === 'assistant' || lastRole === 'staff') atual = 'REVISÃO_MANUAL';
    return {
      last4,
      dossier,
      atual,
      last_role: lastRole,
      snippet: row ? redactSnippet(row.content, 80) : null,
      resume_proibido: NEVER_RESUME.includes(last4),
    };
  });
  return {
    n: items.length,
    never_resume: NEVER_RESUME,
    items,
  };
}

module.exports = {
  NEVER_RESUME,
  CANDIDATA_PENDENTE,
  REVISAO_MANUAL,
  consultarPrecoServico,
  consultarPrecoServicoLive,
  consultarFaqEstatica,
  resolverIdCancelamento,
  triarBacklogLast4,
};
