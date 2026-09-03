/**
 * Medição de contexto 0-LLM para CLIs salao/ (OP002 / OP003 / OP004).
 */

const { classifyTessIntent, shouldSkipTess } = require('./tess-context-intent');
const { assembleTessContext } = require('./tess-context-assembler');
const { parseTessContextConfig } = require('./tess-context-config');
const { measureContextBlocks } = require('./tess-context-bytes');
const { createTrinksLocalStore } = require('./trinks-local-store');
const {
  getNextBusinessDays: nextBusinessDaysFrom,
  getTodayIsoInSalonTimeZone,
  mergeSlotContextDates,
  nextSaturdayDates,
  extractRequestedDate,
} = require('./salon-dates');

function getNextBusinessDays(count) {
  return nextBusinessDaysFrom(count, getTodayIsoInSalonTimeZone());
}

function fixtureDeps(messageText, intentResult, config) {
  return {
    sessionId: 'cli-fixture',
    messageText,
    phone: null,
    intentResult,
    config,
    slotContextDays: 10,
    requestedDate: extractRequestedDate(messageText),
    historyForModel: [],
    persistedForModel: null,
    trinksCanonicalName: null,
    operatorResumeNote: null,
    operatorResumeTrigger: null,
    buildDynamicContext: (...args) => args.filter(Boolean).join('\n'),
    getSlots: async (date) => `HORARIOS ${date}\n- fixture`,
    getSlotsGrouped: async (date) => ({
      label: date,
      date,
      professionals: [],
    }),
    getProfessionals: async () => ({ text: 'PROFISSIONAIS fixture', data: [] }),
    getServicesText: async () => ({ text: 'SERVICOS fixture', data: [] }),
    loadClientFutureBookings: async () => [],
    ensureSlotSnapshot: async () => {},
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
  };
}

function liveDeps(db, {
  messageText, phone, intentResult, config, history = [],
}) {
  const store = createTrinksLocalStore(db);
  return {
    sessionId: 'cli-live',
    messageText,
    phone: phone || null,
    intentResult,
    config,
    slotContextDays: 10,
    requestedDate: extractRequestedDate(messageText),
    historyForModel: history,
    persistedForModel: null,
    trinksCanonicalName: null,
    operatorResumeNote: null,
    operatorResumeTrigger: null,
    buildDynamicContext: (...args) => args.filter(Boolean).join('\n'),
    getSlots: async (date) => {
      const from = new Date(`${date}T00:00:00-03:00`);
      const to = new Date(from.getTime() + 86400000);
      const slots = await store.listSlots({ from, to });
      const lines = (slots || []).slice(0, 80).map((s) => String(s.starts_at || ''));
      return `HORARIOS ${date}\n${lines.join('\n')}`;
    },
    getSlotsGrouped: async (date) => ({
      label: date,
      date,
      professionals: [],
    }),
    getProfessionals: async () => {
      const rows = await store.listProfessionals();
      const text = (rows || []).map((p) => p.nickname || p.name).join('\n');
      return { text: `PROFISSIONAIS\n${text}`, data: rows || [] };
    },
    getServicesText: async () => {
      const rows = await store.listServices();
      const text = (rows || []).map((s) => s.name).join('\n');
      return { text: `SERVICOS\n${text}`, data: rows || [] };
    },
    loadClientFutureBookings: async (p) => {
      const digits = String(p || '').replace(/\D/g, '');
      if (!digits) return [];
      const r = await db.query(
        `SELECT * FROM trinks_appointments
          WHERE client_phone = $1 AND scheduled_at > NOW()
            AND status IN ('scheduled','confirmed')
          ORDER BY scheduled_at ASC LIMIT 10`,
        [digits],
      );
      return r?.rows || [];
    },
    ensureSlotSnapshot: async () => {},
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
  };
}

async function medirOrcamentoContexto({
  texto,
  mode = 'full',
  db = null,
  phone = null,
  history = [],
}) {
  const intentResult = classifyTessIntent(texto, history, []);
  const config = parseTessContextConfig({ TESS_CONTEXT_MODE: mode });
  const deps = db
    ? liveDeps(db, { messageText: texto, phone, intentResult, config, history })
    : fixtureDeps(texto, intentResult, config);
  const assembled = await assembleTessContext(deps);
  const bytes = measureContextBlocks(assembled.blocks);
  return {
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    signals: intentResult.signals,
    context_profile: assembled.contextProfile,
    tess_context_mode: config.effectiveMode,
    fetchMeta: assembled.fetchMeta,
    blocks: bytes,
  };
}

async function simularPerfilContexto({ texto, db = null, phone = null, history = [] }) {
  const modes = ['full', 'scoped'];
  const rows = [];
  for (const mode of modes) {
    rows.push(await medirOrcamentoContexto({ texto, mode, db, phone, history }));
  }
  return rows;
}

function classificarIntencao({ texto, historico = [], futureBookings = [] }) {
  return classifyTessIntent(texto, historico, futureBookings);
}

function simularSkipTrivial({
  texto,
  historico = [],
  skipEnabled = true,
  isMedia = false,
  isOwner = false,
}) {
  const intentResult = classifyTessIntent(texto, historico, []);
  const skip = shouldSkipTess({
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    history: historico,
    messageText: texto,
    isMedia,
    skipEnabled,
    isOwner,
  });
  return {
    skip,
    motivo: skip ? 'trivial_allowlist' : (!skipEnabled ? 'flag_off' : intentResult.intent),
    intent: intentResult.intent,
    confidence: intentResult.confidence,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function parseContextBytesLine(line) {
  const text = String(line || '').trim();
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    if (obj.event && obj.event !== 'tess.context_bytes') return null;
    const chars = obj.blocks?.total?.chars ?? obj.payload?.blocks?.total?.chars;
    if (chars == null) return null;
    return {
      intent: obj.intent || obj.payload?.intent || 'n/a',
      context_profile: obj.context_profile || obj.payload?.context_profile || 'n/a',
      tess_context_mode: obj.tess_context_mode || obj.payload?.tess_context_mode || 'n/a',
      chars: Number(chars) || 0,
    };
  } catch {
    return null;
  }
}

function agregarBytesContexto(lines) {
  const rows = (Array.isArray(lines) ? lines : String(lines || '').split('\n'))
    .map(parseContextBytesLine)
    .filter(Boolean);
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.intent}|${row.context_profile}|${row.tess_context_mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.chars);
  }
  const buckets = [...groups.entries()].map(([key, values]) => {
    const [intent, context_profile, tess_context_mode] = key.split('|');
    const sorted = [...values].sort((a, b) => a - b);
    return {
      intent,
      context_profile,
      tess_context_mode,
      n: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    };
  });
  return { n: rows.length, buckets };
}

async function agregarBytesContextoDb(db, { minutos = 1440 } = {}) {
  const windowMin = Math.min(10080, Math.max(15, Number(minutos) || 1440));
  const result = await db.query(
    `SELECT payload
       FROM bot_operational_events
      WHERE event = 'tess.context_bytes'
        AND received_at >= NOW() - ($1 * INTERVAL '1 minute')
      ORDER BY received_at DESC
      LIMIT 2000`,
    [windowMin],
  );
  const lines = (result?.rows || []).map((row) => JSON.stringify({
    event: 'tess.context_bytes',
    ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
  }));
  return { window_min: windowMin, ...agregarBytesContexto(lines) };
}

module.exports = {
  classificarIntencao,
  medirOrcamentoContexto,
  simularPerfilContexto,
  simularSkipTrivial,
  agregarBytesContexto,
  agregarBytesContextoDb,
};
