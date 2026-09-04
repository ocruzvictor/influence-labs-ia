/**
 * Studio Tirra — Webchat Backend (substitui n8n cloud)
 *
 * Fluxo: POST /webhook/demo-chat
 *   1. Parse payload { message, session_id, contact_name }
 *   2. Consulta Trinks API em paralelo (horários + profissionais)
 *   3. Monta contexto dinamico compacto
 *   4. Chama TESS API (agent configuravel) com contexto dinamico da Trinks
 *   5. Detecta confirmacao de agendamento na resposta TESS
 *   6. Se confirmado: extrai dados do historico → busca servicoId Trinks → POST /appointments
 *   7. Retorna { response, timestamp }
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');
const { sleep, collapseToKapsoSends, sanitizeWhatsappMarkdown } = require('./lib/message-splitter');
const {
  getNextBusinessDays: nextBusinessDaysFrom,
  extractRequestedDate,
  isSalonOpen,
  bookingFitsExpediente,
  filterSlotsWithinExpediente,
  nextSaturdayDates,
  mergeSlotContextDates,
  isClaudiaFridaySlot,
} = require('./lib/salon-dates');
const { formatAnnotatedTimes, bookingFitsSlotWindow } = require('./lib/slot-windows');
const {
  groupOpenSlots,
  formatFullSlotsBlock,
  snapshotAgeMinFromSynced,
  SNAPSHOT_STALE_OFFER_MIN,
} = require('./lib/tess-context-slots');
const {
  sanitizePremiumResponse,
  RETRY_USER_MESSAGE,
} = require('./lib/tess-premium-sanitize');
const { summarizeFailedTessResponse } = require('./lib/tess-errors');
const {
  isTessTimeoutError,
  createTessTimeoutResult,
  createTessTimeoutEvent,
} = require('./lib/tess-timeout');
const {
  createIdempotencyKey,
  decideCreateIdempotency,
  forgetCreateKeyForAppointment,
  buildCreateSuccessMessage,
  pickCreateGuard,
  comboOverlaps,
  formatDataFmtFrom201,
  resolveServicoNomeFrom201,
  findActiveAppointmentConflict,
} = require('./lib/booking-guards');
const { getBotState, resolvePhoneAccess } = require('./lib/bot-state');
const {
  markHumanHandled: markHumanHandledPersist,
  isHumanHandled,
  countActiveSilenced,
  persistStaffOutbound,
} = require('./lib/bot-thread-state');
const { tessAuthHeaders, tessWorkspaceConfigured, tessWorkspaceId } = require('./lib/tess-auth');
const nightwatchOps = require('./lib/nightwatch-ops');
const { mountNightwatchMcp } = require('./lib/nightwatch-mcp');

// --- Load .env (zero deps) ---
try {
  require('fs').readFileSync(__dirname + '/.env', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      if (!process.env[key]) process.env[key] = match[2].trim();
    }
  });
} catch {}

const TESS_TOKEN = process.env.TESS_API_TOKEN;
const TESS_AGENT_ID = String(process.env.TESS_AGENT_ID || '46589');
const TESS_API_BASE = (process.env.TESS_API_BASE || 'https://api.tess.im').replace(/\/+$/, '');
const TESS_URL = process.env.TESS_API_URL || `${TESS_API_BASE}/agents/${TESS_AGENT_ID}/execute`;
const TESS_REQUEST_TIMEOUT_MS = 25_000;
// x-workspace-id obrigatório 01/09/2026. 403 em 2026-03-09 foi workspace de demo (1269475),
// não a key do 46589. Prod: TESS_WORKSPACE_ID (Victor 2026-08-28: 1458234).

// Story 1.5: KB dinâmica via TESS memory_collection.
// Quando setado, callTESS() envia memory_collections=[<id>] em cada chamada, fazendo
// o agente consultar memories editadas pelo painel admin via RAG semantic.
// Unset = graceful degradation: bot opera sem KB dinâmica (apenas prompt da TESS UI).
const TIRRA_KB_COLLECTION_ID = process.env.TIRRA_KB_COLLECTION_ID
  ? Number(process.env.TIRRA_KB_COLLECTION_ID)
  : null;
if (TIRRA_KB_COLLECTION_ID !== null && !Number.isInteger(TIRRA_KB_COLLECTION_ID)) {
  console.warn(`[tess] TIRRA_KB_COLLECTION_ID inválido: ${process.env.TIRRA_KB_COLLECTION_ID} — ignorando`);
}
const KB_ACTIVE = Number.isInteger(TIRRA_KB_COLLECTION_ID);
console.log(`[tess] memory_collections ${KB_ACTIVE ? `ativo (id=${TIRRA_KB_COLLECTION_ID})` : 'inativo (graceful degradation)'}`);
const TRINKS_KEY = process.env.TRINKS_API_KEY;
const TRINKS_API_BASE = process.env.TRINKS_API_BASE || 'https://api.trinks.com/v1';
const TRINKS_EST_ID = process.env.TRINKS_ESTABELECIMENTO_ID || '243868';

// --- Whitelist de telefones (modo teste — seguro por padrao) ---
// Lista de telefones (digitos apenas) autorizados a acionar o bot. Vazio = bot silencioso para todos.
// Para producao "aceita todos", defina BOT_ACCEPT_ALL=true.
const BOT_ALLOWED_PHONES = (process.env.BOT_ALLOWED_PHONES || '')
  .split(',')
  .map(s => s.trim().replace(/\D/g, ''))
  .filter(Boolean);
const BOT_ACCEPT_ALL = process.env.BOT_ACCEPT_ALL === 'true';

// --- Human takeover state (Postgres bot_thread_state + cache 5s por phone) ---
// Coexistencia: quando o staff do salao responde manualmente pelo app, Kapso envia
// 'whatsapp.message.sent' com origin='business_app' (se o evento estiver assinado).
// Marcamos a conversa como human-handled e o bot fica silencioso por HUMAN_HANDLED_TTL_HOURS.
const HUMAN_HANDLED_TTL_MS = (parseInt(process.env.HUMAN_HANDLED_TTL_HOURS || '6', 10)) * 60 * 60 * 1000;

async function markHumanHandled(phone, reason = 'handoff') {
  await markHumanHandledPersist(phone, reason, { ttlMs: HUMAN_HANDLED_TTL_MS });
}

// Parser de tags de booking — importado de modulo compartilhado (backend/lib/).
// Single source of truth pra prod (este arquivo) e scripts de teste.
const {
  normalizeJsonQuotes,
  parseInlineArgs,
  stripBookingTags,
  stripResidualBookingTags,
  sanitizePrematureConfirm,
  selectOutboundBlocks,
  resolveServiceName,
  applyOperationalHabilitacao,
  renderHabilitacaoMap,
  formatIncompatibleProfServiceMessage,
  buildPersistedSection,
  renderFutureBookings,
  formatServiceCatalogLine,
  formatConsultiveBlockMessage,
  formatZeroPriceBlockMessage,
  formatNeedsReferenceBlockMessage,
  servicesForProfessional,
  sanitizeInventedClientTurns,
  isConsultiveColorService,
  isFreeAllowlistedService,
  isBookingOwnedByClient,
  resolveCancelAgendamentoId,
  resolveRescheduleAgendamentoId,
  formatRescheduleRefusalMessage,
  needsReferenceService,
  hasRecentClientImageMarker,
} = require('./lib/booking-parser');
const { normalizeKapsoMediaContent } = require('./lib/kapso-media');

// Monitor de cota Trinks (contador mensal compartilhado) — story trinks-quota-monitor.
const { getRequestBudget, newlyCrossed } = require('./lib/trinks-usage');
const {
  recordTessCredits,
  getTessCreditUsage,
  fetchTessAccountSnapshot,
  saveCreditAlertState,
  newlyDropped,
  formatTessCreditAlert,
} = require('./lib/tess-credit-usage');
const { createTrinksApi } = require('./lib/trinks-api');
const { buildCancelPayload, buildCreateClientPayload, QUEM_CANCELOU } = require('./lib/trinks-mapping');
const { shouldHandoffEmptyTess, handleEmptyTessHandoff } = require('./lib/tess-empty-handoff');
const { createTrinksLocalStore } = require('./lib/trinks-local-store');
const { createTrinksSnsHandler, SnsValidationError } = require('./lib/trinks-sns');
const { createTrinksWebhookProcessor } = require('./lib/trinks-webhook-processor');
const { handleMetaAccountUpdates, handleKapsoAccountV2Events } = require('./lib/whatsapp-account-events');
const { isOwnerPhone, renderOwnerContext, renderOperatorResumeContext } = require('./lib/owner-access');
const { shouldEmitHandoff, emitOperationalEvent } = require('./lib/operational-events');
const {
  resumeConversation,
  peekPendingResumeNote,
  markResumeNoteConsumed,
  OPERATOR_RESUME_TRIGGER,
} = require('./lib/resume-conversation');
const {
  shouldAttemptOwnerResume,
  handleOwnerResumeInbound,
} = require('./lib/owner-resume-parser');
const { parseTessContextConfig } = require('./lib/tess-context-config');
const {
  classifyTessIntent,
  shouldSkipTess,
  isMediaMessage,
  trivialSkipResponse,
} = require('./lib/tess-context-intent');
const {
  assembleTessContext,
  emitContextBytesLog,
  extractTessCredits,
  logTessTurnTelemetry,
} = require('./lib/tess-context-assembler');
const { persistContextBytesEvent, persistTessTurnEvent } = require('./lib/tess-context-bytes');
const { saveConversationTurns: persistConversationTurns } = require('./lib/conversation-history');
const { newTraceId, withTrace } = require('./lib/tess-trace');
const { startOutboundWatchdog } = require('./lib/outbound-outbox');
const { buildHandoffSlaPayload, formatHandoffSlaNotice } = require('./lib/handoff-sla');

const app = express();
app.use(cors());
app.use(express.text({
  type: ['text/plain', 'text/*'],
  limit: '256kb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
// verify captura o corpo cru — necessario para validar assinatura HMAC da Meta (X-Hub-Signature-256)
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
const sessionState = new Map();
const SALON_TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_NAMES_PT = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function getDatePartsInSalonTimeZone(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
  };
}

function getTodayIsoInSalonTimeZone() {
  const { year, month, day } = getDatePartsInSalonTimeZone();
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getWeekdayNamePt(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return WEEKDAY_NAMES_PT[date.getUTCDay()];
}

function formatDateLabel(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return String(dateStr || 'data nao informada');
  const [, month, day] = dateStr.split('-');
  return `${day}/${month} (${getWeekdayNamePt(dateStr)})`;
}

function formatFullDateLabel(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return String(dateStr || 'data nao informada');
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year} (${getWeekdayNamePt(dateStr)})`;
}

function evictOldSessions() {
  if (sessionState.size <= 500) return;
  const sorted = [...sessionState.entries()].sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));
  sorted.slice(0, 100).forEach(([key]) => sessionState.delete(key));
}

const SLOT_CONTEXT_DAYS = Math.max(1, Number(process.env.TRINKS_SLOT_CONTEXT_DAYS || 10));
const TESS_CONTEXT_CONFIG = parseTessContextConfig();
console.log(`[tess] context mode=${TESS_CONTEXT_CONFIG.effectiveMode} skip_trivial=${TESS_CONTEXT_CONFIG.skipTrivial}`);

function getNextBusinessDays(count) {
  return nextBusinessDaysFrom(count, getTodayIsoInSalonTimeZone());
}

function mapSlotPayload(date, payload) {
  const rows = [];
  for (const professional of Array.isArray(payload?.data) ? payload.data : []) {
    for (const time of professional.horariosVagos || []) {
      rows.push({
        professionalId: professional.id,
        startsAt: `${date}T${time}:00-03:00`,
        available: true,
        raw: { date, time, professional },
      });
    }
  }
  return rows;
}

async function ensureSlotSnapshot(date) {
  if (!date || await trinksLocalStore.hasSlotSnapshotForDate(date)) return;
  const payload = await trinksApi.request(`/agendamentos/profissionais/${date}`, {
    origin: 'slot_outside_snapshot',
  });
  await trinksLocalStore.replaceSlotsForDate(date, mapSlotPayload(date, payload));
}

const DYNAMIC_CONTEXT_PREFIX = 'CONTEXTO DINAMICO - TRINKS (snapshot local alimentado por webhooks):';
const OPERATIONAL_NOTES = [
  'NOTAS OPERACIONAIS (vale mesmo se a KB TESS estiver desatualizada):',
  '- Maquiagem: só Fefe. Penteado: só Gi. Ignore outros nomes nesses dois serviços.',
  '- Camuflagem = coloração só dos fios brancos (coloração ou tonalizante). Não vendemos a marca Gloss; Capral/Trans/Igora são marcas de uso, não SKU. Preço = Coloração / Tonalização, Retoque de Raiz ou Coloração Global no snapshot, depois de confirmar se é só raiz. "Raiz com tonalizante" não é dois serviços.',
  '- HORARIOS VAGOS: só ofereça início se duracaoMinutos ≤ minutos contínuos anotados. Se o início aparece e o seguinte não, o seguinte está ocupado.',
].join('\n');

// --- Memory helpers (PostgreSQL) ---
async function loadClientMemory(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return { history: [], client: null };

  const [histResult, clientResult] = await Promise.all([
    db.query(
      `SELECT role, content FROM conversation_history
       WHERE client_phone = $1 ORDER BY created_at DESC LIMIT 15`,
      [digits]
    ),
    db.query(
      `SELECT name, last_service, last_visit, visit_count FROM clients WHERE phone = $1`,
      [digits]
    ),
  ]);

  return {
    history: histResult ? histResult.rows.reverse() : [],
    client: clientResult?.rows[0] || null,
  };
}

// Story bot-46589 item 3 (Rota C): agendamentos FUTUROS e ativos do cliente, lidos do
// trinks_appointments local (sincronizado pelo worker da Story 1.6) — ZERO chamada Trinks.
// Expõe o trinks_id (bookingId) que o prompt precisa pra cancelar/remarcar. Fail-soft: [] em erro.
async function loadClientFutureBookings(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return [];
  try {
    const r = await db.query(
      `SELECT trinks_id, service_id, service_name, professional_id,
              professional_name, scheduled_at, duration_min, status
         FROM trinks_appointments
        WHERE client_phone = $1 AND scheduled_at > NOW() AND status IN ('scheduled','confirmed')
        ORDER BY scheduled_at ASC LIMIT 10`,
      [digits]
    );
    return r ? r.rows : [];
  } catch (err) {
    console.error('[future-bookings] erro:', err.message);
    return [];
  }
}

// Formata timestamptz (scheduled_at) como "DD/MM/YYYY às HH:MM" no fuso do salão.
function formatBookingDateTime(ts) {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: SALON_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const pick = t => parts.find(p => p.type === t)?.value;
    return `${pick('day')}/${pick('month')}/${pick('year')} às ${pick('hour')}:${pick('minute')}`;
  } catch {
    return String(ts);
  }
}

async function saveConversationTurns(phone, turns, traceId) {
  return persistConversationTurns(db, phone, withTrace(turns, traceId));
}

async function upsertClient(phone, name) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return;
  await db.query(
    `INSERT INTO clients (phone, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, clients.name),
       updated_at = NOW()`,
    [digits, name || null]
  );
}

async function updateClientAfterBooking(phone, serviceName) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || !serviceName) return;
  await db.query(
    `INSERT INTO clients (phone, last_service, last_visit, visit_count, updated_at)
     VALUES ($1, $2, NOW(), 1, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       last_service = $2,
       last_visit = NOW(),
       visit_count = clients.visit_count + 1,
       updated_at = NOW()`,
    [digits, serviceName]
  );
}

function formatRequestedDateLine(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return '';
  const weekday = getWeekdayNamePt(dateStr);
  const weekdayLabel = weekday === 'domingo' || weekday === 'segunda'
    ? weekday
    : `${weekday}-feira`;
  const [year, month, day] = dateStr.split('-');
  const openState = isSalonOpen(new Date(`${dateStr}T12:00:00-03:00`));
  const status = openState.open ? 'ABERTO' : 'FECHADO';
  return `DATA SOLICITADA: ${day}/${month}/${year} (${weekdayLabel}) — salão ${status}.`;
}

function formatMultiServiceHandoffMessage() {
  return 'Vou passar pra recepção continuar o encaixe com você — eles combinam os serviços certinho. Um momento! 😊';
}

function buildDynamicContext(businessDays, slotsText, professionalsText, history = [], servicesText = '', persistedMemory = null, futureBookings = [], habilitacaoText = '', channelPhone = null, requestedDate = null, canonicalName = null, operatorResumeNote = null) {
  const persistedSection = buildPersistedSection(persistedMemory, channelPhone, canonicalName);
  const futureBookingsSection = renderFutureBookings(futureBookings, formatBookingDateTime); // item 3 Rota C
  const ownerSection = renderOwnerContext(channelPhone);
  const operatorSection = operatorResumeNote ? renderOperatorResumeContext(operatorResumeNote) : '';
  const speakerLabel = isOwnerPhone(channelPhone) ? 'Tiago (dono)' : 'Cliente';
  const historyText = history.length
    ? '\n\nHISTORICO DA CONVERSA:\n' + history
        .map(m => `${m.role === 'user' ? speakerLabel : 'Assistente'}: ${m.content}`)
        .join('\n')
    : '';
  const salonNow = isSalonOpen();
  const horarioAgora = salonNow.open
    ? `HORARIO_AGORA: ${salonNow.hhmm} (DENTRO do horario — salao ABERTO)`
    : `HORARIO_AGORA: ${salonNow.hhmm} (FORA do horario — ${salonNow.reason}). Agende normalmente mas avise o cliente que a recepção confere de manha.`;
  const requestedDateLine = requestedDate ? formatRequestedDateLine(requestedDate) : '';
  return [
    DYNAMIC_CONTEXT_PREFIX,
    ...(ownerSection ? [ownerSection, ''] : []),
    ...(operatorSection ? [operatorSection, ''] : []),
    `HOJE: ${formatFullDateLabel(getTodayIsoInSalonTimeZone())}`,
    horarioAgora,
    'HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO',
    OPERATIONAL_NOTES,
    ...(requestedDateLine ? [requestedDateLine, ''] : []),
    `DATAS COM DADOS DISPONIVEIS: ${businessDays.map(formatDateLabel).join(', ')}`,
    '',
    habilitacaoText,
    slotsText,
    professionalsText,
    servicesText,
    persistedSection,
    futureBookingsSection,
    historyText,
  ].join('\n');
}

// --- Trinks helpers ---
const TRINKS_MONTHLY_BUDGET = parseInt(process.env.TRINKS_MONTHLY_BUDGET || '10000', 10);
const TRINKS_OPERATIONAL_CAP = parseInt(process.env.TRINKS_OPERATIONAL_CAP || '8500', 10);
const trinksLocalStore = createTrinksLocalStore(db);
const trinksApi = createTrinksApi({
  db,
  baseUrl: TRINKS_API_BASE,
  apiKey: TRINKS_KEY,
  establishmentId: TRINKS_EST_ID,
  budget: TRINKS_MONTHLY_BUDGET,
  operationalCap: TRINKS_OPERATIONAL_CAP,
});
const trinksWebhookProcessor = createTrinksWebhookProcessor({
  db,
  store: trinksLocalStore,
});
const TRINKS_SNS_TOPIC_ARN = process.env.TRINKS_SNS_TOPIC_ARN || '';
const TRINKS_SNS_BOOTSTRAP = process.env.TRINKS_SNS_BOOTSTRAP === 'true';
const trinksSnsHandler = createTrinksSnsHandler({
  resolveExpectedTopicArn: async (envelope) => {
    if (TRINKS_SNS_TOPIC_ARN) return TRINKS_SNS_TOPIC_ARN;
    const confirmedTopicArn = await trinksWebhookProcessor.getConfirmedTopicArn();
    if (confirmedTopicArn) return confirmedTopicArn;
    if (TRINKS_SNS_BOOTSTRAP && envelope.Type === 'SubscriptionConfirmation') {
      return null;
    }
    return null;
  },
  allowSubscriptionBootstrap: TRINKS_SNS_BOOTSTRAP,
  persistEnvelope: trinksWebhookProcessor.persistEnvelope,
  processNotification: trinksWebhookProcessor.processNotification,
  markSubscriptionConfirmed: messageId => trinksWebhookProcessor.markProcessed(messageId),
  markSubscriptionFailed: (messageId, envelope, err) => (
    trinksWebhookProcessor.markProcessed(messageId, String(err.message).slice(0, 500))
  ),
});

// --- Trinks health ping (Story 1.7) ---
// Cache aplicado em sucesso E falha pra nao martelar Trinks em outage.
// ERA 60s → se o painel /saude fica aberto (polling 10s), eram ~1440 chamadas/dia só de ping.
// Default 10min (configurável TRINKS_PING_TTL_S) pra preservar a cota mensal de 5.000.
const TRINKS_PING_TTL_MS = (parseInt(process.env.TRINKS_PING_TTL_S || '21600', 10)) * 1000;
const TRINKS_SLOW_THRESHOLD_MS = 1500;
let trinksPingCache = { payload: null, expiresAt: 0 };

async function pingTrinks() {
  const now = Date.now();
  if (trinksPingCache.payload && now < trinksPingCache.expiresAt) {
    return { ...trinksPingCache.payload, cached: true };
  }
  try {
    const t0 = Date.now();
    await trinksApi.refreshConsumption();
    const latency_ms = Date.now() - t0;
    const payload = {
      status: latency_ms > TRINKS_SLOW_THRESHOLD_MS ? 'slow' : 'ok',
      latency_ms,
      last_checked_at: new Date().toISOString(),
    };
    trinksPingCache = { payload, expiresAt: Date.now() + TRINKS_PING_TTL_MS };
    return { ...payload, cached: false };
  } catch (err) {
    const payload = {
      status: 'down',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'ping_failed',
    };
    trinksPingCache = { payload, expiresAt: Date.now() + TRINKS_PING_TTL_MS };
    return { ...payload, cached: false };
  }
}

// Postgres last-OK tracker (Story 1.7)
let globalLastOkAt = null;

async function fetchSlotsGrouped(date) {
  const from = new Date(`${date}T00:00:00-03:00`);
  const to = new Date(from.getTime() + 86400000);
  const [slots, professionals] = await Promise.all([
    trinksLocalStore.listSlots({ from, to }),
    trinksLocalStore.listProfessionals(),
  ]);
  const openSlots = filterSlotsWithinExpediente(slots);
  const professionalNames = new Map(professionals.map((p) => [
    String(p.trinks_id),
    p.nickname || p.name || `Profissional ${p.trinks_id}`,
  ]));
  const grouped = groupOpenSlots(
    openSlots,
    professionalNames,
    (profName, startsAt) => isClaudiaFridaySlot(profName, startsAt),
  );
  return {
    label: formatDateLabel(date),
    date,
    professionals: grouped,
    snapshotAgeMin: snapshotAgeMinFromSynced(openSlots.map((slot) => slot.synced_at)),
  };
}

async function getSlotsGrouped(date) {
  try {
    return await fetchSlotsGrouped(date);
  } catch (err) {
    console.error('Local slots grouped error:', err.message);
    return {
      label: formatDateLabel(date),
      date,
      professionals: [],
      error: err.message,
    };
  }
}

async function getSlots(date) {
  try {
    const grouped = await fetchSlotsGrouped(date);
    if (!grouped.professionals.length) {
      return `HORARIOS VAGOS ${grouped.label}:\n- Nenhum horario disponivel no snapshot local.`;
    }
    return `${formatFullSlotsBlock(grouped.label, grouped.professionals)}\n`;
  } catch (err) {
    console.error('Local slots error:', err.message);
    return 'HORARIOS: Snapshot local indisponivel. Encaminhe para atendimento humano.';
  }
}

async function listProfessionalSlotStarts(professionalId, dateStr) {
  if (!professionalId || !dateStr) return [];
  try {
    const from = new Date(`${dateStr}T00:00:00-03:00`);
    const to = new Date(from.getTime() + 86400000);
    const slots = await trinksLocalStore.listSlots({
      from,
      to,
      professionalId: String(professionalId),
    });
    return filterSlotsWithinExpediente(slots).map((slot) => slot.starts_at);
  } catch (err) {
    console.warn('[slots] listProfessionalSlotStarts falhou:', err.message);
    return [];
  }
}

async function getProfessionals() {
  try {
    const rows = await trinksLocalStore.listProfessionals();
    const data = rows.map(p => ({
      id: /^\d+$/.test(String(p.trinks_id)) ? Number(p.trinks_id) : p.trinks_id,
      nome: p.name,
      apelido: p.nickname,
      ativo: p.active,
    }));
    if (!data.length) return { text: 'PROFISSIONAIS: Snapshot local vazio.', data: [] };
    let txt = 'PROFISSIONAIS ATIVOS:\n';
    for (const p of data) {
      txt += `- ${p.apelido || p.nome} (ID ${p.id})\n`;
    }
    return { text: txt, data };
  } catch (err) {
    console.error('Local professionals error:', err.message);
    return { text: 'PROFISSIONAIS: Snapshot local indisponivel.', data: [] };
  }
}

async function getServicesText() {
  try {
    const [services, compatibilities, professionals] = await Promise.all([
      trinksLocalStore.listServices(),
      trinksLocalStore.listCompatibility(),
      trinksLocalStore.listProfessionals(),
    ]);
    const professionalNames = new Map(professionals.map(p => [
      String(p.trinks_id),
      p.nickname || p.name,
    ]));
    const namesByService = new Map();
    for (const pair of compatibilities) {
      const key = String(pair.service_id);
      if (!namesByService.has(key)) namesByService.set(key, []);
      const name = professionalNames.get(String(pair.professional_id));
      if (name) namesByService.get(key).push(name);
    }
    const list = applyOperationalHabilitacao(services.map(s => ({
      id: /^\d+$/.test(String(s.trinks_id)) ? Number(s.trinks_id) : s.trinks_id,
      nome: s.name,
      duracaoEmMinutos: s.duration_min,
      preco: Number(s.price_cents || 0) / 100,
      profissionais: namesByService.get(String(s.trinks_id)) || [],
    })));
    if (!list.length) return { text: 'SERVICOS: Erro ao consultar.', data: [] };
    let txt = 'SERVICOS DISPONIVEIS (use o nome EXATO; snapshot é autoritativo para SKUs com preço; linhas com "preço sob avaliação" seguem regras comerciais — não são cotação):\n';
    for (const s of list) {
      txt += `${formatServiceCatalogLine(s)}\n`;
    }
    return { text: txt, data: list };
  } catch (err) {
    console.error('Local services text error:', err.message);
    return { text: 'SERVICOS: Snapshot local indisponivel.', data: [] };
  }
}

// Busca servicos de um profissional especifico (retorna id + duracao)
async function getServiceForProfessional(professionalId, serviceName) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove prefixos de ruido comuns na extracao do historico
  const cleanedName = (serviceName || '').replace(/^(o\s+agendamento\s+de\s+|os?\s+servic[oa]s?\s+de\s+|a\s+confirmac[aã]o\s+de\s+)/i, '').trim();
  const target = norm(cleanedName);
  try {
      const [services, compatibility] = await Promise.all([
        trinksLocalStore.listServices(),
        trinksLocalStore.listCompatibility({ professionalId }),
      ]);
      const allowed = new Set(compatibility.map(item => String(item.service_id)));
      const list = services
        .filter(service => allowed.has(String(service.trinks_id)))
        .map(service => ({
          id: /^\d+$/.test(String(service.trinks_id)) ? Number(service.trinks_id) : service.trinks_id,
          nome: service.name,
          duracaoEmMinutos: service.duration_min,
          preco: Number(service.price_cents || 0) / 100,
        }));
      // Sinonimos de dominio: "corte" = "cabelo" em contexto de salao
      const SYNONYMS = { corte: 'cabelo', cabelo: 'corte' };
      const words = (s) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      // Para o target, expande sinonimos para melhorar o match
      const rawTargetWords = words(cleanedName);
      const targetWords = [...new Set(rawTargetWords.flatMap(w => SYNONYMS[w] ? [w, SYNONYMS[w]] : [w]))];
      // Ranqueia por score (melhor match ganha, nao o primeiro que passa o threshold)
      let bestScore = 0;
      let found = null;
      for (const s of list) {
        const svcName = s.nome || s.name || '';
        const n = norm(svcName);
        let score = 0;
        if (n === target) score = 100;
        else if (n.includes(target) || target.includes(n)) score = 80;
        else {
          const svcWords = words(svcName);
          const overlap = targetWords.filter(w => svcWords.some(sw => sw.includes(w) || w.includes(sw)));
          // Penaliza servicos com palavras extras nao presentes no target (evita "Infantil" etc)
          const extraSvcWords = svcWords.filter(sw => !targetWords.some(w => sw.includes(w) || w.includes(sw)));
          score = targetWords.length ? (overlap.length / targetWords.length) * 50 : 0;
          score -= extraSvcWords.length * 3;
        }
        if (score > bestScore) { bestScore = score; found = s; }
      }
      if (bestScore < 25) found = null;
      console.log(`[Local Trinks] Match "${serviceName}" → "${found?.nome}" (score ${bestScore})`);
      if (found) return { id: found.id, duracao: found.duracao || found.duracaoEmMinutos || found.duration || 60, valor: found.valor ?? found.preco ?? found.price ?? 0 };
  } catch (err) {
    console.error('[Local Trinks] service lookup erro:', err.message);
  }
  return null;
}

// Busca clienteId (ID global) pelo telefone via GET /clientes?telefone=X.
// Documentacao oficial (trinks.readme.io): POST /agendamentos usa clienteId, nao clienteEstabelecimentoId.
async function getClientId(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  const local = await trinksLocalStore.getClientByPhone(digits);
  if (local?.trinks_id) return local.trinks_id;
  try {
    const json = await trinksApi.request(`/clientes?telefone=${digits}`, {
      origin: 'agent_client_lookup',
      essential: true,
    });
    const item = Array.isArray(json.data) ? json.data[0] : json.data;
    if (item?.id) {
      console.log(`[Trinks] clienteId: ${item.id} (${item.nome})`);
      await trinksLocalStore.upsertClient({
        trinksId: item.id,
        phone: digits,
        name: item.nome,
        email: item.email,
        birthDate: item.dataNascimento,
        active: item.ativo !== false,
        raw: item,
      });
      return item.id;
    }
  } catch (err) {
    console.log(`[Trinks] /clientes?telefone=${digits} → ${err.message}`);
    throw err;
  }
  console.warn(`[Trinks] cliente nao encontrado para telefone ${digits}`);
  return null;
}

function buildAgentMutationMetadata(clientPhone, kapsoConversationId) {
  const metadata = {};
  const digits = String(clientPhone || '').replace(/\D/g, '');
  if (digits) metadata.client_phone = digits;
  if (kapsoConversationId != null && kapsoConversationId !== '') {
    metadata.kapso_conversation_id = String(kapsoConversationId);
  }
  return metadata;
}

async function createClientInTrinks(phone, name, { clientPhone, kapsoConversationId } = {}) {
  const digits = String(phone || '').replace(/\D/g, '');
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = national.slice(0, 2);
  const numero = national.slice(2);
  if (ddd.length !== 2 || numero.length < 8) throw new Error('telefone invalido para criar cliente');
  const payload = buildCreateClientPayload({
    estabelecimentoId: TRINKS_EST_ID,
    nome: name,
    ddd,
    numero,
  });
  const response = await trinksApi.request('/clientes', {
    method: 'POST',
    body: payload,
    origin: 'agent_mutation_create_client',
    essential: true,
    metadata: buildAgentMutationMetadata(clientPhone || phone, kapsoConversationId),
  });
  const client = response.data || response;
  const clientId = client.id || client.clienteId;
  if (!clientId) throw new Error('Trinks nao retornou o id do novo cliente');
  await trinksLocalStore.upsertClient({
    trinksId: clientId,
    phone: digits,
    name: client.nome || payload.nome,
    raw: client,
  });
  return clientId;
}

// Fuzzy name match (normaliza acentos e caixa)
function matchByName(list, name, ...keys) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const target = norm(name);
  const fields = keys.length ? keys : ['nome', 'apelido'];
  return list.find(item =>
    fields.some(k => {
      const v = norm(item[k]);
      return v && (v.includes(target) || target.includes(v));
    })
  );
}

// Remove tags de booking do texto exibido ao cliente.
//
// Suporta DOIS formatos:
//
// (a) Formato v2 inline (prompt v2, prod 2026-05-26+):
//     [BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-05-30T10:30:00-03:00 valor=85]
//     [BOOKING_CANCEL bookingId=498220145]
//     [BOOKING_RESCHEDULE bookingId=X novoDataHoraInicio=2026-05-31T11:00:00-03:00]
//     [HANDOFF_HUMAN motivo=cliente_pediu_humano]
//
// (b) Formato v1 legacy (BOOKING_CONFIRM + JSON em linha separada):
//     [BOOKING_CONFIRM]\n{"service_name":"...","professional_id":N,"date_time":"...","duration_minutes":N}
//
// Output normalizado (compatível com createBookingInTrinks / cancel / reschedule):
//   bookingConfirm: { service_id?, service_name?, professional_id, date_time, duration_minutes?, valor? }
//   bookingCancel:  { agendamento_id?, date?, professional_id?, motivo? }
//   bookingReschedule: { agendamento_id?, old_date?, professional_id?, date_time, service_name?, duration_minutes? }
//   handoffHuman:   { motivo: string }
// Funções parseInlineArgs / stripBookingTags / sanitizePrematureConfirm /
// normalizeJsonQuotes / PREMATURE_CONFIRM_PATTERNS movidos para
// backend/lib/booking-parser.js (single source of truth importado no topo).

// Extrai numero de telefone do historico da conversa
function extractPhoneFromHistory(history) {
  for (const msg of [...history].reverse()) {
    if (msg.role !== 'user') continue;
    const m = msg.content.match(/\b(\d{10,11})\b/);
    if (m) return m[1];
  }
  return null;
}

// Busca agendamentos do cliente por data via GET /agendamentos
async function findClientBooking(clienteId, date, professionalId) {
  const dayStart = new Date(`${date}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  try {
    const list = await trinksLocalStore.listAppointmentsByTrinksClient(clienteId, {
      from: dayStart,
      to: dayEnd,
    });
    console.log(`[Local Trinks] findClientBooking clienteId:${clienteId} data:${date} → ${list.length} agendamentos`);
    if (!list.length) return null;
    let found = list[0];
    if (professionalId) {
      const match = list.find(b => String(b.professional_id) === String(professionalId));
      if (match) found = match;
    }
    return { ...found, id: found.trinks_id };
  } catch (err) {
    console.error('[Local Trinks] findClientBooking erro:', err.message);
    return null;
  }
}

// Cancela agendamento via PATCH /agendamentos/{id}/status/cancelado
// quemCancelou = enum (1=cliente), NÃO o Trinks client id — ver trinks-mapping.QUEM_CANCELOU.
async function cancelBookingInTrinks(agendamentoId, motivo, quemCancelou = QUEM_CANCELOU.CLIENTE, { clientPhone, kapsoConversationId } = {}) {
  const current = await trinksLocalStore.getAppointment(agendamentoId);
  const payload = buildCancelPayload(motivo, quemCancelou);
  const result = await trinksApi.request(`/agendamentos/${agendamentoId}/status/cancelado`, {
    method: 'PATCH',
    body: payload,
    origin: 'agent_mutation_cancel',
    essential: true,
    metadata: buildAgentMutationMetadata(clientPhone, kapsoConversationId),
  });
  try {
    await trinksLocalStore.markAppointmentStatus(agendamentoId, 'cancelled', {
      cancelledAt: new Date(),
    });
    if (current?.professional_id && current?.scheduled_at) {
      const durationMin = Number(current.duration_min) || 30;
      await trinksLocalStore.markSlotWindowAvailable(
        current.professional_id,
        current.scheduled_at,
        durationMin,
        true,
      );
    }
  } catch (err) {
    console.error('[Local Trinks] cancelamento confirmado, snapshot pendente:', err.message);
  }
  return { ...result, agendamentoId, cancelado: true };
}

// Reagenda agendamento via PUT /agendamentos/{id}
async function rescheduleBookingInTrinks(agendamentoId, booking, professionalsData, { clientPhone, kapsoConversationId } = {}) {
  const current = await trinksLocalStore.getAppointment(agendamentoId);
  const profId = booking.professionalId
    || matchByName(professionalsData, booking.professional || '', 'apelido', 'nome')?.id;

  const [svcData, clienteId] = await Promise.all([
    booking.serviceId
      ? trinksLocalStore.getService(booking.serviceId).then(service => service && ({
        id: service.trinks_id,
        duracao: service.duration_min,
        valor: Number(service.price_cents || 0) / 100,
      }))
      : (profId ? getServiceForProfessional(profId, booking.service) : Promise.resolve(null)),
    booking.clientPhone ? getClientId(booking.clientPhone) : Promise.resolve(null),
  ]);

  const duracao = svcData?.duracao || booking.durationMinutes || 0;
  const payload = {
    dataHoraInicio: `${booking.date}T${booking.time}:00`,
    profissionalId: profId || undefined,
    duracaoEmMinutos: duracao,
    clienteId: clienteId || undefined,
    servicoId: svcData?.id || undefined,
    valor: svcData?.valor ?? 0,
  };

  if (!payload.profissionalId || !payload.servicoId) {
    throw new Error('profissional ou servico nao resolvido para reagendamento');
  }
  if (!(await trinksLocalStore.isCompatible(payload.servicoId, payload.profissionalId))) {
    throw new Error('combinacao profissional-servico incompativel');
  }
  const result = await trinksApi.request(`/agendamentos/${agendamentoId}`, {
    method: 'PUT',
    body: payload,
    origin: 'agent_mutation_reschedule',
    essential: true,
    metadata: buildAgentMutationMetadata(clientPhone || booking.clientPhone, kapsoConversationId),
  });
  try {
    await trinksLocalStore.markAppointmentStatus(agendamentoId, 'scheduled', {
      scheduledAt: `${booking.date}T${booking.time}:00-03:00`,
    });
    if (current?.professional_id && current?.scheduled_at) {
      const oldDur = Number(current.duration_min) || duracao || 30;
      await trinksLocalStore.markSlotWindowAvailable(
        current.professional_id,
        current.scheduled_at,
        oldDur,
        true,
      );
    }
    await trinksLocalStore.markSlotWindowAvailable(
      payload.profissionalId,
      `${booking.date}T${booking.time}:00-03:00`,
      duracao || 30,
      false,
    );
  } catch (err) {
    console.error('[Local Trinks] reagendamento confirmado, snapshot pendente:', err.message);
  }
  return { ...result, agendamentoId, reagendado: true };
}

// Fallback: extrai dados do historico quando TESS nao emitiu tag estruturada
function extractFromHistory(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    const text = msg.content;
    const m = text.match(
      /(?:confirmar?[:\s]+|agendad[oa][!:.\s]+)(.+?)\s+com\s+(?:[oa]\s+)?([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?)\b.*?(\d{1,2}\/\d{2})(?:\/\d{4})?\b.*?\b(\d{1,2})h(\d{0,2})/i
    );
    if (m) {
      const [, service, professional, dateStr, hh, mm] = m;
      const [day, month] = dateStr.split('/');
      const year = new Date().getFullYear();
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const time = `${hh.padStart(2, '0')}:${(mm || '00').padStart(2, '0')}`;
      return { service: service.trim(), professional: professional.trim(), date, time };
    }
  }
  return null;
}

async function createBookingInTrinks(booking, professionalsData, { clientPhone, kapsoConversationId } = {}) {
  const profId = booking.professionalId
    || matchByName(professionalsData, booking.professional || '', 'apelido', 'nome')?.id;

  // Caminho rápido: se prompt v2 já mandou servicoId numérico, pulamos lookup por nome.
  // Senão, mantemos lookup legado por nome (compat com prompt v1 ou casos sem ID).
  const hasDirectServiceId = booking.serviceId !== undefined && booking.serviceId !== null;

  const [svcData, existingClientId] = await Promise.all([
    hasDirectServiceId
      ? trinksLocalStore.getService(booking.serviceId).then(service => service && ({
        id: service.trinks_id,
        duracao: service.duration_min,
        valor: Number(service.price_cents || 0) / 100,
      }))
      : (profId ? getServiceForProfessional(profId, booking.service) : Promise.resolve(null)),
    booking.clientPhone ? getClientId(booking.clientPhone) : Promise.resolve(null),
  ]);
  const clienteId = existingClientId || (
    booking.clientPhone
      ? await createClientInTrinks(booking.clientPhone, booking.clientName, {
        clientPhone: clientPhone || booking.clientPhone,
        kapsoConversationId,
      })
      : null
  );

  const servicoId = hasDirectServiceId ? booking.serviceId : svcData?.id;
  const valor = booking.valor ?? svcData?.valor ?? 0;
  const duracao = svcData?.duracao || booking.durationMinutes || 0;

  // POST /agendamentos — campos conforme documentacao oficial trinks.readme.io:
  // clienteId (int32), servicoId (int32), dataHoraInicio (date-time), duracaoEmMinutos (int32), valor (double)
  const payload = {
    dataHoraInicio: `${booking.date}T${booking.time}:00`,
    profissionalId: profId || undefined,
    duracaoEmMinutos: duracao,
    clienteId: clienteId || undefined,
    servicoId: servicoId || undefined,
    valor,
  };

  console.log(`[Trinks] Resolved — profId:${profId} svcId:${servicoId} clienteId:${clienteId} duracao:${duracao} valor:${valor} (v2:${hasDirectServiceId})`);
  if (!profId || !servicoId || !clienteId) {
    throw new Error('profissional, servico ou cliente nao resolvido para agendamento');
  }
  if (!(await trinksLocalStore.isCompatible(servicoId, profId))) {
    throw new Error('combinacao profissional-servico incompativel');
  }
  const data = await trinksApi.request('/agendamentos', {
    method: 'POST',
    body: payload,
    origin: 'agent_mutation_create',
    essential: true,
    metadata: buildAgentMutationMetadata(clientPhone || booking.clientPhone, kapsoConversationId),
  });
  const created = data.data || data;
  const appointmentId = created.id || created.agendamentoId;
  if (appointmentId) {
    const professional = professionalsData.find(p => String(p.id) === String(profId));
    try {
      await trinksLocalStore.upsertAppointment({
        trinksId: appointmentId,
        clientTrinksId: clienteId,
        clientPhone: (booking.clientPhone || '').replace(/\D/g, ''),
        professionalId: profId,
        professionalName: professional?.apelido || professional?.nome,
        serviceId: servicoId,
        serviceName: booking.service,
        status: 'scheduled',
        scheduledAt: `${booking.date}T${booking.time}:00-03:00`,
        durationMin: duracao || null,
        priceCents: Math.round(Number(valor || 0) * 100),
        raw: created,
      });
    } catch (err) {
      console.error('[Local Trinks] agendamento confirmado, snapshot pendente:', err.message);
    }
  }
  try {
    await trinksLocalStore.markSlotWindowAvailable(
      profId,
      `${booking.date}T${booking.time}:00-03:00`,
      duracao || 30,
      false,
    );
  } catch (err) {
    console.error('[Local Trinks] slot confirmado, snapshot pendente:', err.message);
  }
  return data;
}

// --- TESS helper ---
// root_id usado para manter thread TESS. Contexto dinamico injetado no user message (nao system),
// pois o agente TESS tem system prompt proprio no dashboard e ignora o role:system da API.
async function callTESS(messages, rootId) {
  const body = { messages, wait_execution: true };
  if (Number.isInteger(rootId)) body.root_id = rootId;
  // Story 1.5: anexa memory_collections quando configurado — TESS faz RAG semantic
  // injetando memories relevantes no contexto da próxima resposta do agente.
  if (KB_ACTIVE) body.memory_collections = [TIRRA_KB_COLLECTION_ID];
  const headers = tessAuthHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(TESS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TESS_REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const hints = {
      403: `verifique permissao do token para agent ${TESS_AGENT_ID}`,
      404: `endpoint nao encontrado (${TESS_URL}); verifique TESS_API_URL ou TESS_AGENT_ID (${TESS_AGENT_ID})`,
    };
    const hint = hints[res.status] ? ` | hint: ${hints[res.status]}` : '';
    throw new Error(`TESS ${res.status}: ${body}${hint}`);
  }
  return res.json();
}

function extractTESSResponse(raw) {
  if (typeof raw === 'string') return raw;
  // TESS format: { responses: [{ output: "..." }] }
  if (raw.responses?.[0]?.output) return String(raw.responses[0].output);
  if (raw.output) return String(raw.output);
  if (raw.choices?.[0]?.message?.content) return raw.choices[0].message.content;
  if (raw.response) return String(raw.response);
  if (raw.text) return String(raw.text);
  if (typeof raw.content === 'string') return raw.content;
  if (Array.isArray(raw.content) && raw.content[0]?.text) return raw.content[0].text;
  return '';
}

function extractTESSRootId(raw) {
  const candidates = [raw?.root_id, raw?.responses?.[0]?.root_id, raw?.data?.root_id, raw?.execution?.root_id];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return null;
}


function removeRepeatedIntro(text) {
  let out = text.trim();
  out = out.replace(
    /^(?:ol[áa]!\s*)?(?:bem[-\s]?vindo\(a\)[\s\S]{0,120}?(?:[.!?]\s+|$))(?:tudo bem\?\s*)?(?:meu nome[\s\S]{0,120}?(?:[.!?]\s+|$))?/i,
    '',
  ).trim();
  out = out.replace(/^(?:como posso te ajudar(?: hoje)?\??|como posso te atender(?: hoje)?\??)\s*/i, '').trim();
  return out;
}

function normalizeFormatting(text) {
  let out = text.trim();
  out = out.replace(/\*\*(.*?)\*\*/g, '$1');
  out = out.replace(/^[ \t]*[\*\-][ \t]+/gm, '- ');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function formatAssistantOutput(rawText, isFirstTurn) {
  let text = normalizeFormatting(rawText);
  text = sanitizeInventedClientTurns(text);
  if (!isFirstTurn) text = removeRepeatedIntro(text);
  if (!text) text = 'Perfeito. Me diz o que voce prefere que eu te ajudo agora.';
  const responses = collapseToKapsoSends(text);
  return {
    response: responses[0] || text,
    responses: responses.length ? responses : [text],
  };
}


/**
 * Turno TESS proativo pós-resume — sem fake user turn da nota do operador.
 * source=operator_resume via bloco ORIENTACAO_OPERADOR no contexto dinâmico.
 */
async function runOperatorResumeTurn(phone, operatorNote) {
  const sessionId = phone;
  const state = sessionState.get(sessionId) || { turn: 0, rootId: null, history: [], persistedMemory: null };

  let trinksCanonicalName = null;
  if (state.history.length === 0 && phone) {
    const mem = await loadClientMemory(phone);
    state.persistedMemory = (mem.history.length || mem.client) ? mem : null;
    try {
      const digits = String(phone).replace(/\D/g, '');
      const trinksClient = await trinksLocalStore.getClientByPhone(digits);
      if (trinksClient?.name) trinksCanonicalName = trinksClient.name;
    } catch {
      /* non-blocking */
    }
  }

  const historyForClassify = state.history.slice(-8);
  const futureBookingsForClassify = phone ? await loadClientFutureBookings(phone) : [];
  const intentResult = classifyTessIntent(
    OPERATOR_RESUME_TRIGGER,
    historyForClassify,
    futureBookingsForClassify,
    { lastBookingOutcome: state.lastBookingOutcome },
  );

  const requestedDate = extractRequestedDate(OPERATOR_RESUME_TRIGGER);
  const historyForModel = state.history.slice(-8);
  const persistedForModel = state.persistedMemory
    ? {
      ...state.persistedMemory,
      history: (state.persistedMemory.history || []).slice(-8),
    }
    : null;

  const assembledCtx = await assembleTessContext({
    sessionId,
    messageText: OPERATOR_RESUME_TRIGGER,
    phone,
    intentResult,
    config: TESS_CONTEXT_CONFIG,
    slotContextDays: SLOT_CONTEXT_DAYS,
    requestedDate,
    historyForModel,
    persistedForModel,
    trinksCanonicalName,
    operatorResumeNote: operatorNote,
    operatorResumeTrigger: OPERATOR_RESUME_TRIGGER,
    buildDynamicContext,
    getSlots,
    getSlotsGrouped,
    getProfessionals,
    getServicesText,
    loadClientFutureBookings,
    ensureSlotSnapshot,
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
  });

  console.log(`[${sessionId}] operator_resume TESS turn (note_len=${operatorNote.length})`);

  const tessRaw = await callTESS([
    { role: 'user', content: assembledCtx.userMessageWithContext },
  ], state.rootId);

  let tessText = extractTESSResponse(tessRaw);
  const premiumResult = await sanitizePremiumResponse({
    tessText,
    sessionId,
    retryCall: async () => {
      const retryRaw = await callTESS([
        { role: 'user', content: assembledCtx.userMessageWithContext },
        { role: 'assistant', content: tessText },
        { role: 'user', content: RETRY_USER_MESSAGE },
      ], state.rootId);
      return extractTESSResponse(retryRaw);
    },
  });
  tessText = premiumResult.text;

  const rootId = extractTESSRootId(tessRaw);
  if (rootId) state.rootId = rootId;

  if (!tessText) {
    throw new Error('tess_empty_response');
  }

  const {
    clean: cleanText,
    handoffHuman,
  } = stripBookingTags(tessText);
  const leakFreeText = stripResidualBookingTags(cleanText);
  const sanitizedCleanText = sanitizeWhatsappMarkdown(leakFreeText);
  const formatted = formatAssistantOutput(sanitizedCleanText, state.turn === 0);

  state.history.push({ role: 'assistant', content: sanitizedCleanText });
  state.turn += 1;
  state.lastAccess = Date.now();
  sessionState.set(sessionId, state);

  return {
    text: formatted.response,
    responses: formatted.responses,
    handoffHuman,
    persistAssistant: async (clientPhone, content) => {
      await saveConversationTurns(clientPhone, [{ role: 'assistant', content }]);
    },
  };
}


// --- Core message orchestration ---
async function processMessage(sessionId, messageText, contactName, incomingHistoryRaw, phone = null, kapsoConversationId = null, inboundTraceId = null) {
  const startTime = Date.now();
  const turnTraceId = inboundTraceId || newTraceId();
  const state = sessionState.get(sessionId) || { turn: 0, rootId: null, history: [], persistedMemory: null };

  // Cold start: load persisted memory from DB (phone sessions) or client-side history fallback (webchat)
  let trinksCanonicalName = null;
  if (state.history.length === 0) {
    if (phone) {
      const mem = await loadClientMemory(phone);
      state.persistedMemory = (mem.history.length || mem.client) ? mem : null;
      if (state.persistedMemory) console.log(`[${sessionId}] Memory loaded: ${mem.history.length} turns, client: ${!!mem.client}`);
      if (contactName && contactName !== 'Cliente') upsertClient(phone, contactName).catch(() => {});
    } else if (Array.isArray(incomingHistoryRaw) && incomingHistoryRaw.length > 0) {
      state.history = incomingHistoryRaw.filter(m => m.role && m.content).slice(-20);
    }
  }
  if (phone) {
    try {
      const digits = String(phone).replace(/\D/g, '');
      const trinksClient = await trinksLocalStore.getClientByPhone(digits);
      if (trinksClient?.name) {
        trinksCanonicalName = trinksClient.name;
        if (state.persistedMemory) {
          state.persistedMemory.client = state.persistedMemory.client || {};
          state.persistedMemory.client.name = trinksClient.name;
        }
      }
    } catch (err) {
      console.warn(`[${sessionId}] trinks client lookup falhou:`, err.message);
    }
  }
  if (isOwnerPhone(phone)) {
    console.log(`[${sessionId}] INTERLOCUTOR=TIAGO (dono) contact="${contactName}"`);
  }
  console.log(`[${sessionId}] ${contactName}: "${messageText}"`);

  // Classificar intenção ANTES do fetch Trinks (context-on-demand)
  const historyForClassify = state.history.slice(-8);
  const futureBookingsForClassify = phone ? await loadClientFutureBookings(phone) : [];
  const intentResult = classifyTessIntent(messageText, historyForClassify, futureBookingsForClassify, {
    lastBookingOutcome: state.lastBookingOutcome,
  });
  const isMedia = isMediaMessage(messageText);

  let pendingOperatorNote = null;
  if (phone) {
    pendingOperatorNote = await peekPendingResumeNote(db, phone);
    if (pendingOperatorNote) {
      console.log(`[${sessionId}] pending resume note (len=${pendingOperatorNote.length}) — force TESS turn`);
    }
  }

  const skippedTess = pendingOperatorNote
    ? false
    : shouldSkipTess({
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      history: historyForClassify,
      messageText,
      isMedia,
      skipEnabled: TESS_CONTEXT_CONFIG.skipTrivial,
      trivialMaxChars: TESS_CONTEXT_CONFIG.trivialMaxChars,
      isOwner: isOwnerPhone(phone),
    });

  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry?.role !== 'user' || lastEntry.content !== messageText) {
    state.history.push({ role: 'user', content: messageText });
  }

  const requestedDate = extractRequestedDate(messageText);
  const historyForModel = state.history.slice(-8);
  const persistedForModel = state.persistedMemory
    ? {
      ...state.persistedMemory,
      history: (state.persistedMemory.history || []).slice(-8),
    }
    : null;

  let tessText;
  let tessRaw = null;
  let svcPayload = { text: '', data: [] };
  let profsPayload = { text: '', data: [] };
  let contextProfile = 'FULL';
  let assembledCtx = null;
  let tessCredits = null;

  if (skippedTess) {
    tessText = trivialSkipResponse();
    contextProfile = 'MIN';
    const skipBlocks = {
      shell: tessText,
      horarios: '',
      servicos: '',
      habilitacao: '',
      profissionais: '',
      historico: '',
      future_bookings: '',
      user_payload: tessText,
    };
    const skipBytes = emitContextBytesLog(
      {
        intent: intentResult.intent,
        contextProfile,
        confidence: intentResult.confidence,
        blocks: skipBlocks,
      },
      sessionId,
      TESS_CONTEXT_CONFIG,
      true,
      { confidence: intentResult.confidence, traceId: turnTraceId },
    );
    persistContextBytesEvent(db, skipBytes, phone).catch(() => {});
    logTessTurnTelemetry({
      sessionId,
      intent: intentResult.intent,
      contextProfile,
      skippedTess: true,
      tessCredits: null,
    });
    recordTessCredits(db, tessCredits ?? 0);
    persistTessTurnEvent(db, {
      clientPhone: phone,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      contextProfile,
      tessCredits: 0,
      skippedTess: true,
      totalChars: skipBytes?.blocks?.total?.chars || 0,
      traceId: turnTraceId,
      sessionId,
    }).catch(() => {});
  } else {
    assembledCtx = await assembleTessContext({
      sessionId,
      messageText,
      phone,
      intentResult,
      config: TESS_CONTEXT_CONFIG,
      slotContextDays: SLOT_CONTEXT_DAYS,
      requestedDate,
      historyForModel,
      persistedForModel,
      trinksCanonicalName,
      operatorResumeNote: pendingOperatorNote,
      buildDynamicContext,
      getSlots,
      getSlotsGrouped,
      getProfessionals,
      getServicesText,
      loadClientFutureBookings,
      ensureSlotSnapshot,
      getNextBusinessDays,
      mergeSlotContextDates,
      nextSaturdayDates,
    });
    svcPayload = {
      text: assembledCtx.svcPayload?.text || '',
      data: Array.isArray(assembledCtx.svcPayload?.data) ? assembledCtx.svcPayload.data : [],
    };
    // Marcel 2513 2026-09-02: CREATE crashava com profsPayload is not defined /
    // .data ausente e o kapso catch engolia o send.
    profsPayload = {
      text: assembledCtx.profsPayload?.text || '',
      data: Array.isArray(assembledCtx.profsPayload?.data) ? assembledCtx.profsPayload.data : [],
    };
    contextProfile = assembledCtx.contextProfile;
    const assembledBytes = emitContextBytesLog(
      assembledCtx,
      sessionId,
      TESS_CONTEXT_CONFIG,
      false,
      { confidence: intentResult.confidence, traceId: turnTraceId },
    );
    persistContextBytesEvent(db, assembledBytes, phone).catch(() => {});
    if (assembledCtx.snapshotStale) {
      emitOperationalEvent(db, {
        event: 'snapshot.stale',
        clientPhone: phone,
        kapsoConversationId,
        motivo: `age_min=${assembledCtx.snapshotAgeMin}`,
        payload: {
          snapshot_age_min: assembledCtx.snapshotAgeMin,
          stale_after_min: SNAPSHOT_STALE_OFFER_MIN,
          trace_id: turnTraceId,
        },
      }).catch(() => {});
    }

    try {
      tessRaw = await callTESS([
        { role: 'user', content: assembledCtx.userMessageWithContext },
      ], state.rootId);

      tessText = extractTESSResponse(tessRaw);
      const premiumResult = await sanitizePremiumResponse({
        tessText,
        sessionId,
        retryCall: async () => {
          const retryRaw = await callTESS([
            { role: 'user', content: assembledCtx.userMessageWithContext },
            { role: 'assistant', content: tessText },
            { role: 'user', content: RETRY_USER_MESSAGE },
          ], state.rootId);
          const retryRoot = extractTESSRootId(retryRaw);
          if (retryRoot) state.rootId = retryRoot;
          return extractTESSResponse(retryRaw);
        },
      });
      tessText = premiumResult.text;
    } catch (err) {
      if (!isTessTimeoutError(err)) throw err;
      const timeoutResult = createTessTimeoutResult(intentResult.intent);
      console.error(`[${sessionId}] TESS timeout during ${intentResult.intent}:`, err.message);
      emitOperationalEvent(db, createTessTimeoutEvent({
        clientPhone: phone,
        kapsoConversationId,
        intent: intentResult.intent || null,
        contextProfile,
        timeoutMs: TESS_REQUEST_TIMEOUT_MS,
      })).catch(() => {});
      if (phone) {
        saveConversationTurns(phone, [
          { role: 'user', content: messageText, intent: intentResult.intent },
          { role: 'assistant', content: timeoutResult.response, agent: 'tess-timeout', intent: intentResult.intent },
        ], turnTraceId).catch((saveErr) => console.error('[DB] Save TESS timeout turns error:', saveErr.message));
      }
      state.history.push({ role: 'assistant', content: timeoutResult.response });
      state.turn += 1;
      state.lastAccess = Date.now();
      if (state.turn === 1 && state.persistedMemory) {
        state.persistedMemory = { client: state.persistedMemory.client || null, history: [] };
      }
      sessionState.set(sessionId, state);
      evictOldSessions();
      return timeoutResult;
    }
    tessCredits = extractTessCredits(tessRaw);
    logTessTurnTelemetry({
      sessionId,
      intent: intentResult.intent,
      contextProfile,
      skippedTess: false,
      tessCredits,
    });
    recordTessCredits(db, tessCredits ?? 0);
    persistTessTurnEvent(db, {
      clientPhone: phone,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      contextProfile,
      tessCredits,
      skippedTess: false,
      totalChars: assembledBytes?.blocks?.total?.chars || 0,
      traceId: turnTraceId,
      sessionId,
    }).catch(() => {});

    if (pendingOperatorNote && phone && tessText) {
      await markResumeNoteConsumed(db, phone);
      console.log(`[${sessionId}] resume note consumed after TESS turn`);
    }
  }

  const rootId = tessRaw ? extractTESSRootId(tessRaw) : null;
  if (rootId) state.rootId = rootId;
  if (!tessText) {
    console.error('[TESS] Empty response:', JSON.stringify(summarizeFailedTessResponse(tessRaw)));
    const fallback = 'Ola! Estou com uma dificuldade tecnica. Nosso atendimento humano entrara em contato em breve!';
    const emptyCredits = extractTessCredits(tessRaw);
    emitOperationalEvent(db, {
      event: 'tess.empty',
      clientPhone: phone,
      kapsoConversationId,
      payload: { intent: intentResult?.intent || null, credits: emptyCredits },
    }).catch(() => {});
    await handleEmptyTessHandoff({
      credits: emptyCredits,
      phone,
      db,
      kapsoConversationId,
      markHumanHandled,
      shouldEmitHandoff,
      emitOperationalEvent,
    }).catch((err) => console.error('[empty-handoff] error:', err.message));
    if (phone) {
      saveConversationTurns(phone, [
        { role: 'assistant', content: fallback, agent: 'tess-fallback', intent: intentResult.intent },
      ], turnTraceId).catch((err) => console.error('[DB] Save empty-TESS fallback error:', err.message));
    }
    return {
      response: fallback,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Strip booking tags from text (TESS emite tags que nao devem aparecer ao cliente)
  let {
    clean: cleanText,
    bookingConfirm,
    bookingCreates = [],
    bookingCancel,
    bookingCancels = [],
    bookingReschedule,
    bookingReschedules = [],
    handoffHuman,
  } = stripBookingTags(tessText);
  const leakFreeText = stripResidualBookingTags(cleanText);
  const sanitizedCleanText = sanitizeWhatsappMarkdown(leakFreeText);

  emitOperationalEvent(db, {
    event: 'tags.parsed',
    clientPhone: phone,
    kapsoConversationId,
    payload: {
      creates: bookingCreates.length,
      cancels: bookingCancels.length,
      reschedules: bookingReschedules.length,
      handoff: !!handoffHuman,
    },
  }).catch(() => {});

  const leakedTags = leakFreeText.match(/\[(BOOKING_|HANDOFF_)[^\]]+\]/gi);
  if (leakedTags?.length) {
    emitOperationalEvent(db, {
      event: 'tags.leaked',
      clientPhone: phone,
      kapsoConversationId,
      payload: { tagNames: leakedTags },
    }).catch(() => {});
  }

  // 2-phase: se ha tag de booking, sanitizar "Agendado!/Confirmado!/Pronto!" antes de exibir.
  // Razao: bot nao deve afirmar que agendou antes da Trinks responder (rota infeliz mente pro cliente).
  // Mensagem final de sucesso/falha eh construida pelo backend apos chamada a Trinks (bloco 4 abaixo).
  const createsToRun = bookingCreates.length ? bookingCreates : (bookingConfirm ? [bookingConfirm] : []);
  const cancelsToRun = bookingCancels.length ? bookingCancels : (bookingCancel ? [bookingCancel] : []);
  const afterFailOrBlock = state.lastBookingOutcome === 'failed' || state.lastBookingOutcome === 'blocked';
  const displayText = sanitizePrematureConfirm(sanitizedCleanText, {
    afterFailOrBlock,
    comboSecondBlocked: false,
  });
  if (afterFailOrBlock) state.lastBookingOutcome = null;
  const formatted = formatAssistantOutput(displayText, state.turn === 0);
  state.history.push({ role: 'assistant', content: displayText });
  state.turn += 1;
  state.lastAccess = Date.now();
  // After first turn, session history is authoritative — keep cadastro, drop HISTORICO ANTERIOR.
  if (state.turn === 1 && state.persistedMemory) {
    state.persistedMemory = { client: state.persistedMemory.client || null, history: [] };
  }
  sessionState.set(sessionId, state);
  evictOldSessions();

  // Persist conversation turns to PostgreSQL (fire-and-forget, non-blocking)
  if (phone) {
    saveConversationTurns(phone, [
      { role: 'user', content: messageText, intent: intentResult.intent },
      { role: 'assistant', content: displayText, intent: intentResult.intent },
    ], turnTraceId).catch(err => console.error('[DB] Save turns error:', err.message));
  }

  // 4. Executar acao no Trinks de acordo com tag emitida pelo TESS
  let bookingResult = null;
  let bookingCreatedThisTurn = false;
  // Prioriza phone do canal (kapso/meta sabe quem mandou) — historico so quando webchat sem identificacao
  const clientPhone = phone || extractPhoneFromHistory(state.history);

  // Mensagens finais 2-phase (apos chamada a Trinks). Acumuladas em finalMessages,
  // enviadas como blocos extras apos o reply principal sanitizado.
  const finalMessages = [];

  const futureBookings = clientPhone ? await loadClientFutureBookings(clientPhone) : [];

  // 4a. Criar agendamento(s) — combo: processa em sequência e para no primeiro erro
  const distinctServiceIds = new Set(
    createsToRun.map((c) => c.service_id).filter((id) => id != null),
  );

  let needsReferenceBlock = null;
  let consultivePreBlock = null;
  for (const createTag of createsToRun) {
    const svcEntryRef = svcPayload.data.find((s) => String(s.id) === String(createTag.service_id));
    const servicoNomeRef = createTag.service_name || svcEntryRef?.nome || resolveServiceName(svcPayload.data, createTag.service_id);
    if (!consultivePreBlock && isConsultiveColorService(servicoNomeRef)) {
      if (!handoffHuman) handoffHuman = { motivo: 'orcamento_referencia' };
      consultivePreBlock = formatConsultiveBlockMessage();
    }
    if (!needsReferenceBlock && needsReferenceService(servicoNomeRef)) {
      if (!handoffHuman) handoffHuman = { motivo: 'orcamento_referencia' };
      needsReferenceBlock = formatNeedsReferenceBlockMessage({
        serviceName: servicoNomeRef,
        price: svcEntryRef?.preco,
        hasReferenceImage: hasRecentClientImageMarker(state.history),
      });
    }
    if (needsReferenceBlock && consultivePreBlock) break;
  }

  const overlapBlock = !handoffHuman && comboOverlaps(createsToRun);
  if (overlapBlock) {
    handoffHuman = { motivo: 'multi_servico' };
  }

  const skipCreates = Boolean(handoffHuman);
  let createIdempotentSkip = false;
  let comboFirstSucceeded = false;
  let comboSecondBlocked = false;

  const markBookingOutcome = (outcome) => {
    state.lastBookingOutcome = outcome;
    sessionState.set(sessionId, state);
  };

  if (skipCreates && createsToRun.length) {
    const blockKind = needsReferenceBlock
      ? 'needs_reference'
      : consultivePreBlock
        ? 'consultive'
        : overlapBlock
          ? 'combo_overlap'
          : 'handoff';
    console.log(
      `[${sessionId}] Booking CREATE blocked:`,
      blockKind,
      `distinctServices=${distinctServiceIds.size}`,
    );
    if (needsReferenceBlock) {
      finalMessages.push(needsReferenceBlock);
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: {
          kind: 'needs_reference',
          hasReferenceImage: hasRecentClientImageMarker(state.history),
          distinctServiceCount: distinctServiceIds.size,
        },
      }).catch(() => {});
    } else if (consultivePreBlock) {
      finalMessages.push(consultivePreBlock);
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: {
          kind: 'consultive',
          distinctServiceCount: distinctServiceIds.size,
        },
      }).catch(() => {});
    } else {
      finalMessages.push(formatMultiServiceHandoffMessage());
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: {
          kind: overlapBlock ? 'combo_overlap' : 'handoff',
          distinctServiceCount: distinctServiceIds.size,
        },
      }).catch(() => {});
    }
    markBookingOutcome('blocked');
  } else if (createsToRun.length) {
    try {
    if (!state.createKeys) state.createKeys = new Set();
    const profsData = Array.isArray(profsPayload.data) ? profsPayload.data : [];
    for (const createTag of createsToRun) {
    const profObj = createTag.professional_id
      ? profsData.find(p => p.id === createTag.professional_id)
      : null;
    const bookingData = {
      service: createTag.service_name,
      serviceId: createTag.service_id,
      valor: createTag.valor,
      professional: profObj?.apelido || null,
      professionalId: createTag.professional_id,
      date: createTag.date_time?.split('T')[0],
      time: createTag.date_time?.split('T')[1]?.slice(0, 5),
      durationMinutes: createTag.duration_minutes,
      clientPhone,
      clientName: contactName,
    };
    console.log(`[${sessionId}] Booking from tag:`, JSON.stringify(bookingData));
    if (!bookingData.durationMinutes && bookingData.serviceId) {
      const svcEntry = svcPayload.data.find(s => String(s.id) === String(bookingData.serviceId));
      bookingData.durationMinutes = svcEntry?.duracaoEmMinutos || svcEntry?.duration_min || 0;
    }
    const fit = bookingFitsExpediente(
      bookingData.date,
      bookingData.time,
      bookingData.durationMinutes,
    );
    const janelaFit = bookingFitsSlotWindow(
      await listProfessionalSlotStarts(bookingData.professionalId, bookingData.date),
      bookingData.date,
      bookingData.time,
      bookingData.durationMinutes,
    );
    let appointmentConflict = null;
    if (bookingData.professionalId && bookingData.date) {
      const dayStart = new Date(`${bookingData.date}T00:00:00-03:00`);
      const dayEnd = new Date(`${bookingData.date}T23:59:59-03:00`);
      const profAppointments = await trinksLocalStore.listAppointmentsByProfessional(
        bookingData.professionalId,
        { from: dayStart, to: dayEnd },
      );
      appointmentConflict = findActiveAppointmentConflict(profAppointments, bookingData, { clientPhone });
    }
    let compatible = true;
    if (bookingData.serviceId && bookingData.professionalId) {
      compatible = await trinksLocalStore.isCompatible(
        bookingData.serviceId,
        bookingData.professionalId,
      );
    }
    const svcEntryGuard = svcPayload.data.find(s => String(s.id) === String(bookingData.serviceId));
    const servicoNomeGuard = bookingData.service || svcEntryGuard?.nome || resolveServiceName(svcPayload.data, bookingData.serviceId);
    const priceZero = !svcEntryGuard?.preco || Number(svcEntryGuard.preco) === 0;
    if (isConsultiveColorService(servicoNomeGuard)) {
      console.warn(
        `[${sessionId}] Booking BLOCKED consultive:`,
        `svc=${bookingData.serviceId}`,
        `name=${servicoNomeGuard}`,
      );
      finalMessages.push(formatConsultiveBlockMessage());
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: { kind: 'consultive', serviceId: bookingData.serviceId, professionalId: bookingData.professionalId },
      }).catch(() => {});
      if (comboFirstSucceeded) comboSecondBlocked = true;
      markBookingOutcome('blocked');
      break;
    }
    if (priceZero && !isFreeAllowlistedService(servicoNomeGuard)) {
      console.warn(
        `[${sessionId}] Booking BLOCKED zero_price:`,
        `svc=${bookingData.serviceId}`,
        `name=${servicoNomeGuard}`,
      );
      finalMessages.push(formatZeroPriceBlockMessage());
      emitOperationalEvent(db, {
        event: 'catalog.zero_price_blocked',
        clientPhone,
        kapsoConversationId,
        payload: { serviceId: bookingData.serviceId, serviceName: servicoNomeGuard },
      }).catch(() => {});
      break;
    }
    const guard = pickCreateGuard({ compatible, expedienteFit: fit, janelaFit, appointmentConflict });
    if (guard.kind === 'incompatible') {
      const servicoNome = bookingData.service || resolveServiceName(svcPayload.data, bookingData.serviceId);
      const svcEntry = svcPayload.data.find(s => String(s.id) === String(bookingData.serviceId));
      const professionalName = profObj?.apelido || profObj?.nome;
      console.warn(
        `[${sessionId}] Booking BLOCKED incompatible:`,
        `prof=${bookingData.professionalId}`,
        `svc=${bookingData.serviceId}`,
      );
      finalMessages.push(formatIncompatibleProfServiceMessage({
        professionalName,
        serviceName: servicoNome,
        enabledProfessionals: svcEntry?.profissionais,
        professionalServices: servicesForProfessional(svcPayload.data, professionalName),
      }));
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: { kind: 'incompatible', serviceId: bookingData.serviceId, professionalId: bookingData.professionalId },
      }).catch(() => {});
      if (comboFirstSucceeded) comboSecondBlocked = true;
      markBookingOutcome('blocked');
      break;
    }
    if (guard.kind === 'expediente') {
      console.warn(`[${sessionId}] Booking BLOCKED expediente: ${guard.reason}`);
      finalMessages.push(
        `Esse horário não fecha dentro do expediente (Ter-Sex 9h-19h, Sáb 9h-18h). ${guard.reason}. Me passa outro horário que caiba no dia que eu te ajudo.`,
      );
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: { kind: 'expediente', serviceId: bookingData.serviceId, professionalId: bookingData.professionalId },
      }).catch(() => {});
      if (comboFirstSucceeded) comboSecondBlocked = true;
      markBookingOutcome('blocked');
      break;
    }
    if (guard.kind === 'janela') {
      console.warn(`[${sessionId}] Booking BLOCKED janela: ${guard.reason}`);
      finalMessages.push(
        `Esse horário não fecha na agenda da profissional — o serviço não cabe na janela livre até o próximo cliente. Me passa outro horário (ou outro dia) que eu te ajudo.`,
      );
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: { kind: 'janela', serviceId: bookingData.serviceId, professionalId: bookingData.professionalId, reason: guard.reason },
      }).catch(() => {});
      if (comboFirstSucceeded) comboSecondBlocked = true;
      markBookingOutcome('blocked');
      break;
    }
    if (guard.kind === 'ocupado') {
      console.warn(`[${sessionId}] Booking BLOCKED ocupado: ${guard.reason}`);
      finalMessages.push(
        'Esse horário já está reservado na agenda da profissional. Me passa outro horário (ou outro dia) que eu te ajudo.',
      );
      emitOperationalEvent(db, {
        event: 'guard.blocked',
        clientPhone,
        kapsoConversationId,
        payload: { kind: 'ocupado', serviceId: bookingData.serviceId, professionalId: bookingData.professionalId, reason: guard.reason },
      }).catch(() => {});
      if (comboFirstSucceeded) comboSecondBlocked = true;
      markBookingOutcome('blocked');
      break;
    }
    const idemKey = createIdempotencyKey(bookingData);
    let existing = [];
    if (clientPhone && bookingData.date) {
      const dayStart = new Date(`${bookingData.date}T00:00:00-03:00`);
      const dayEnd = new Date(`${bookingData.date}T23:59:59-03:00`);
      existing = await trinksLocalStore.listAppointmentsByClient(clientPhone, {
        from: dayStart,
        to: dayEnd,
      });
    }
    const createIdem = decideCreateIdempotency({
      createKeys: state.createKeys,
      bookingData,
      existingRows: existing,
    });
    if (createIdem.skip) {
      console.log(`[idempotency] create duplicado ignorado ${idemKey}`);
      createIdempotentSkip = true;
      continue;
    }
    try {
      bookingResult = await createBookingInTrinks(bookingData, profsData, {
        clientPhone,
        kapsoConversationId,
      });
      bookingCreatedThisTurn = true;
      state.createKeys.add(idemKey);
      console.log(`[${sessionId}] Booking created in Trinks:`, JSON.stringify(bookingResult));
      const servicoNome = resolveServicoNomeFrom201(
        bookingResult,
        bookingData.service || resolveServiceName(svcPayload.data, bookingData.serviceId),
      );
      if (phone && (servicoNome || bookingData.serviceId)) {
        updateClientAfterBooking(phone, servicoNome || `id:${bookingData.serviceId}`).catch(() => {});
      }
      const valorFmt = (bookingData.valor ?? bookingResult?.valor ?? bookingResult?.data?.valor ?? 0).toFixed(2).replace('.', ',');
      const dataFmt = formatDataFmtFrom201(bookingResult, bookingData);
      const profNome = profObj?.apelido || profObj?.nome || 'a equipe';
      const servicoLinha = servicoNome ? `💅 ${servicoNome}\n` : '';
      finalMessages.push(buildCreateSuccessMessage({
        afterHours: !isSalonOpen().open,
        dataFmt,
        servicoLinha,
        profNome,
        valorFmt,
      }));
      emitOperationalEvent(db, {
        event: 'booking.created',
        clientPhone,
        kapsoConversationId,
        payload: {
          trinksId: bookingResult?.id || bookingResult?.agendamentoId,
          serviceId: bookingData.serviceId,
          afterHours: !isSalonOpen().open,
        },
      }).catch(() => {});
      comboFirstSucceeded = true;
    } catch (err) {
      emitOperationalEvent(db, {
        event: 'booking.failed',
        clientPhone,
        motivo: err.message,
        kapsoConversationId,
        payload: {},
      }).catch(() => {});
      markBookingOutcome('failed');
      if (err.message && err.message.includes('incompativel')) {
        const servicoNome = bookingData.service || resolveServiceName(svcPayload.data, bookingData.serviceId);
        const svcEntry = svcPayload.data.find(s => String(s.id) === String(bookingData.serviceId));
        const professionalName = profObj?.apelido || profObj?.nome;
        console.error(
          `[${sessionId}] Booking INCOMPATIBLE prof×servico:`,
          err.message,
          `prof=${bookingData.professionalId}`,
          `svc=${bookingData.serviceId}`,
          `habilitados=[${(svcEntry?.profissionais || []).join(', ')}]`,
        );
        finalMessages.push(formatIncompatibleProfServiceMessage({
          professionalName,
          serviceName: servicoNome,
          enabledProfessionals: svcEntry?.profissionais,
          professionalServices: servicesForProfessional(svcPayload.data, professionalName),
        }));
      } else {
        console.error(`[${sessionId}] Booking creation FAILED:`, err.message);
        finalMessages.push(
          `Opa, tive um problema técnico ao confirmar esse horário 😕\n\n` +
          `Deixa eu tentar outro horário próximo pra você. Me fala se prefere outro dia ou outro profissional?`
        );
      }
      break;
    }
    }
    } catch (err) {
      console.error(`[${sessionId}] Booking CREATE crashed:`, err.message);
      emitOperationalEvent(db, {
        event: 'booking.failed',
        clientPhone,
        motivo: err.message,
        kapsoConversationId,
        payload: { kind: 'create_crash' },
      }).catch(() => {});
      markBookingOutcome('failed');
      if (!finalMessages.length) {
        finalMessages.push(
          `Opa, tive um problema técnico ao confirmar esse horário 😕\n\n` +
          `Deixa eu tentar outro horário próximo pra você. Me fala se prefere outro dia ou outro profissional?`,
        );
      }
    }
  }

  if (createsToRun.length && !skipCreates && !bookingResult && !finalMessages.length && !createIdempotentSkip) {
    console.warn(`[${sessionId}] Booking CREATE dropped: tag parsed but no POST/guard/fail`);
    emitOperationalEvent(db, {
      event: 'booking.dropped',
      clientPhone,
      kapsoConversationId,
      payload: { creates: createsToRun.length },
    }).catch(() => {});
    finalMessages.push(
      'Não consegui gravar esse horário na agenda agora. Me confirma o dia, o serviço e o profissional que eu tento de novo — ou te passo pra recepção.',
    );
  }

  // 4b. Cancelar agendamento(s)
  let cancelSuccessCount = 0;
  if (cancelsToRun.length) {
    console.log(`[${sessionId}] Booking cancel from tags:`, cancelsToRun.length);
    const requestedCancelCount = cancelsToRun.length;
    let clienteId = null;
    try {
      if (!clientPhone) throw new Error('clienteId nao encontrado para cancelamento');
      clienteId = await getClientId(clientPhone);
      if (!clienteId) throw new Error('clienteId nao encontrado para cancelamento');

      const knownServiceIds = (svcPayload?.data || []).map((s) => s.id);
      for (const cancelTag of cancelsToRun) {
        const resolved = resolveCancelAgendamentoId({
          cancelTag,
          futureBookings,
          knownServiceIds,
        });
        let agendamentoId = resolved.agendamentoId;
        if (!agendamentoId && !cancelTag.agendamento_id && cancelTag.date) {
          const found = await findClientBooking(clienteId, cancelTag.date, cancelTag.professional_id);
          const foundId = found?.id || found?.trinks_id || null;
          if (foundId && isBookingOwnedByClient(foundId, futureBookings)) {
            agendamentoId = String(foundId);
          }
        }
        if (!agendamentoId || !isBookingOwnedByClient(agendamentoId, futureBookings)) {
          console.warn(
            `[${sessionId}] Cancel not_owned: bookingId=${cancelTag.agendamento_id || agendamentoId} reason=${resolved.reason || 'unresolved'}`,
          );
          emitOperationalEvent(db, {
            event: 'cancel.not_owned',
            clientPhone,
            kapsoConversationId,
            payload: { requestedId: String(cancelTag.agendamento_id || agendamentoId || '') },
          }).catch(() => {});
          continue;
        }
        try {
          const ownedRow = (futureBookings || []).find((b) => String(b.trinks_id) === String(agendamentoId));
          bookingResult = await cancelBookingInTrinks(agendamentoId, cancelTag.motivo, QUEM_CANCELOU.CLIENTE, {
            clientPhone,
            kapsoConversationId,
          });
          cancelSuccessCount += 1;
          console.log(`[${sessionId}] Booking cancelled in Trinks: agendamentoId ${agendamentoId}`);
          if (state.createKeys) {
            forgetCreateKeyForAppointment(state.createKeys, {
              clientPhone,
              appointment: ownedRow,
            });
          }
        } catch (err) {
          console.error(`[${sessionId}] Booking cancel FAILED id=${agendamentoId}:`, err.message);
        }
      }

      emitOperationalEvent(db, {
        event: 'booking.cancelled',
        clientPhone,
        kapsoConversationId,
        payload: {
          requestedCount: requestedCancelCount,
          successCount: cancelSuccessCount,
          outcome: cancelSuccessCount === requestedCancelCount
            ? 'all'
            : (cancelSuccessCount > 0 ? 'partial' : 'none'),
        },
      }).catch(() => {});

      if (cancelSuccessCount === requestedCancelCount && cancelSuccessCount === 1) {
        finalMessages.push('Pronto, cancelei seu horário! Qualquer coisa, é só chamar pra reagendar. 😊');
      } else if (cancelSuccessCount === requestedCancelCount && cancelSuccessCount > 1) {
        finalMessages.push(`Pronto, cancelei seus ${cancelSuccessCount} horários! Qualquer coisa, é só chamar pra reagendar. 😊`);
      } else if (cancelSuccessCount > 0) {
        finalMessages.push(
          `Consegui cancelar ${cancelSuccessCount} de ${requestedCancelCount} horários. ` +
          'Vou pedir pra recepção resolver o restante com você. Um momento!',
        );
      } else {
        throw new Error('Nenhum cancelamento concluido');
      }
    } catch (err) {
      const payloadLog = err.payload ? JSON.stringify(err.payload).slice(0, 500) : '';
      console.error(`[${sessionId}] Booking cancel FAILED:`, err.message, payloadLog);
      finalMessages.push(
        `Não consegui localizar/cancelar seu horário automaticamente 😕\n` +
        `Vou pedir pra recepção resolver com você. Um momento!`,
      );
    }
  }

  // 4c. Reagendar agendamento
  const reschedulesToRun = bookingReschedules.length
    ? bookingReschedules
    : (bookingReschedule ? [bookingReschedule] : []);
  for (const bookingReschedule of reschedulesToRun) {
    console.log(`[${sessionId}] Booking reschedule from tag:`, JSON.stringify(bookingReschedule));
    try {
      const clienteId = clientPhone ? await getClientId(clientPhone) : null;
      if (!clienteId) throw new Error('clienteId nao encontrado para reagendamento');

      const findResult = bookingReschedule.old_date
        ? await findClientBooking(clienteId, bookingReschedule.old_date, bookingReschedule.professional_id)
        : null;
      const resolved = resolveRescheduleAgendamentoId({
        bookingReschedule,
        futureBookings,
        findClientBookingResult: findResult,
      });

      if (!resolved.agendamentoId) {
        console.warn(`[${sessionId}] Reschedule refused (${resolved.reason}):`, JSON.stringify(bookingReschedule));
        finalMessages.push(formatRescheduleRefusalMessage(resolved.reason));
        continue;
      }

      const agendamentoId = resolved.agendamentoId;

      const newBooking = {
        service: bookingReschedule.service_name,
        serviceId: bookingReschedule.service_id,
        professionalId: bookingReschedule.professional_id,
        date: bookingReschedule.date_time?.split('T')[0],
        time: bookingReschedule.date_time?.split('T')[1]?.slice(0, 5),
        durationMinutes: bookingReschedule.duration_minutes,
        clientPhone,
      };
      if (!newBooking.durationMinutes && newBooking.serviceId) {
        const svcEntry = svcPayload.data.find(s => String(s.id) === String(newBooking.serviceId));
        newBooking.durationMinutes = svcEntry?.duracaoEmMinutos || svcEntry?.duration_min || 0;
      }
      const rescheduleFit = bookingFitsExpediente(
        newBooking.date,
        newBooking.time,
        newBooking.durationMinutes || 0,
      );
      const rescheduleJanela = bookingFitsSlotWindow(
        await listProfessionalSlotStarts(newBooking.professionalId, newBooking.date),
        newBooking.date,
        newBooking.time,
        newBooking.durationMinutes || 0,
      );
      if (!rescheduleFit.ok) {
        console.warn(`[${sessionId}] Reschedule BLOCKED expediente: ${rescheduleFit.reason}`);
        finalMessages.push(
          `Esse horário não fecha dentro do expediente (Ter-Sex 9h-19h, Sáb 9h-18h). ${rescheduleFit.reason}. Me passa outro horário que caiba no dia que eu te ajudo.`,
        );
      } else if (!rescheduleJanela.ok) {
        console.warn(`[${sessionId}] Reschedule BLOCKED janela: ${rescheduleJanela.reason}`);
        finalMessages.push(
          `Esse horário não fecha na agenda da profissional — o serviço não cabe na janela livre até o próximo cliente. Me passa outro horário (ou outro dia) que eu te ajudo.`,
        );
      } else {
        bookingResult = await rescheduleBookingInTrinks(agendamentoId, newBooking, profsPayload.data, {
          clientPhone,
          kapsoConversationId,
        });
        console.log(`[${sessionId}] Booking rescheduled in Trinks: agendamentoId ${agendamentoId}`);
        const dataFmt = newBooking.date && newBooking.time
          ? `${newBooking.date.split('-').reverse().join('/')} às ${newBooking.time}`
          : 'no horario combinado';
        finalMessages.push(`Pronto, reagendei pra ${dataFmt}! Te esperamos. 😊`);
        emitOperationalEvent(db, {
          event: 'booking.rescheduled',
          clientPhone,
          kapsoConversationId,
          payload: {
            trinksId: agendamentoId,
            serviceId: newBooking.serviceId,
            serviceName: bookingReschedule.service_name || newBooking.service,
          },
        }).catch(() => {});
      }
    } catch (err) {
      if (err.message && err.message.includes('incompativel')) {
        const profObj = bookingReschedule.professional_id
          ? profsPayload.data.find(p => p.id === bookingReschedule.professional_id)
          : null;
        const servicoNome = bookingReschedule.service_name || resolveServiceName(svcPayload.data, bookingReschedule.service_id);
        const svcEntry = svcPayload.data.find(s => String(s.id) === String(bookingReschedule.service_id));
        console.error(
          `[${sessionId}] Reschedule INCOMPATIBLE prof×servico:`,
          err.message,
          `prof=${bookingReschedule.professional_id}`,
          `svc=${bookingReschedule.service_id}`,
          `habilitados=[${(svcEntry?.profissionais || []).join(', ')}]`,
        );
        const professionalName = profObj?.apelido || profObj?.nome;
        finalMessages.push(formatIncompatibleProfServiceMessage({
          professionalName,
          serviceName: servicoNome,
          enabledProfessionals: svcEntry?.profissionais,
          professionalServices: servicesForProfessional(svcPayload.data, professionalName),
        }));
      } else {
        console.error(`[${sessionId}] Booking reschedule FAILED:`, err.message);
        finalMessages.push(
          `Tive um problema pra reagendar 😕 Vou pedir pra recepção resolver com você direto. Um momento!`
        );
      }
    }
  }

  // 4d. Handoff humano (TESS sinalizou que precisa de pessoa)
  // OBS: notificacao ao Tiago via Kapso ainda sera implementada (Supervisor sincrono).
  if (handoffHuman) {
    console.log(`[${sessionId}] HANDOFF_HUMAN motivo:${handoffHuman.motivo}`);
    // Marcar conversa como human-handled para silenciar bot ate Tiago responder.
    // Dono: nunca silenciar o próprio thread nem notificar o Tiago sobre ele mesmo.
    if (clientPhone && !isOwnerPhone(clientPhone)) await markHumanHandled(clientPhone, 'handoff');
    if (shouldEmitHandoff(clientPhone)) {
      emitOperationalEvent(db, {
        event: 'handoff.human',
        clientPhone,
        motivo: handoffHuman.motivo,
        kapsoConversationId,
        payload: buildHandoffSlaPayload(),
      }).catch(() => {});
    }
  }

  console.log(`[${sessionId}] Response (${Date.now() - startTime}ms): "${formatted.response.slice(0, 80)}..."`);
  if (comboSecondBlocked && formatted.responses?.length) {
    const resanitized = sanitizePrematureConfirm(formatted.responses[0], { comboSecondBlocked: true });
    formatted.responses[0] = resanitized;
    formatted.response = resanitized;
  }
  // Anexa mensagens finais (sucesso/falha 2-phase) como blocos extras apos o reply principal.
  // AC11: cancel falhou → não enviar texto prematuro ("Cancelando...") antes da msg de erro.
  // B1: createIdempotentSkip sem 2xx → não deixar "Confirmo aqui" da 2-phase.
  const allBlocks = selectOutboundBlocks({
    formattedResponses: formatted.responses,
    finalMessages,
    createIdempotentSkip,
    bookingCreatedThisTurn,
    cancelsToRun,
    cancelSuccessCount,
  });
  const result = {
    response: allBlocks[0],
    responses: allBlocks,
    timestamp: new Date().toISOString(),
  };
  if (bookingResult) result.booking = bookingResult;
  if (handoffHuman && !isOwnerPhone(clientPhone)) result.handoff = handoffHuman;
  // Sinaliza booking criado fora-de-horario para o handler notificar o Tiago.
  const afterHoursSource = createsToRun[0] || bookingConfirm;
  if (afterHoursSource && bookingResult && !isSalonOpen().open) {
    const profObj = afterHoursSource.professional_id
      ? profsPayload.data.find(p => p.id === afterHoursSource.professional_id)
      : null;
    result.afterHoursBooking = {
      booking: {
        service: afterHoursSource.service_name,
        serviceId: afterHoursSource.service_id,
        valor: afterHoursSource.valor,
        professional: profObj?.apelido || null,
        professionalId: afterHoursSource.professional_id,
        date: afterHoursSource.date_time?.split('T')[0],
        time: afterHoursSource.date_time?.split('T')[1]?.slice(0, 5),
      },
      bookingResult,
      clientPhone,
      salonState: isSalonOpen(),
    };
  }
  if (phone && finalMessages.length) {
    saveConversationTurns(
      phone,
      finalMessages.map((content) => ({
        role: 'assistant',
        content,
        agent: 'trinks-2phase',
        intent: intentResult.intent,
      })),
      turnTraceId,
    ).catch((err) => console.error('[DB] Save 2-phase turns error:', err.message));
  }
  return result;
}

function withTimeout(fn, ms) {
  return async (req, res) => {
    const globalTimeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[TIMEOUT] Global ${ms}ms timeout hit`);
        res.json({ response: 'Estou demorando mais que o normal. Pode tentar de novo?', timestamp: new Date().toISOString() });
      }
    }, ms);
    try {
      await fn(req, res);
    } catch (err) {
      console.error('Handler error:', err);
      if (!res.headersSent) {
        res.json({ response: 'Estou com uma dificuldade tecnica no momento. Tente novamente em instantes!', timestamp: new Date().toISOString() });
      }
    } finally {
      clearTimeout(globalTimeout);
    }
  };
}

app.post('/webhook/trinks', async (req, res) => {
  try {
    const snsTypeHeader = req.headers['x-amz-sns-message-type'];
    const envelope = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (snsTypeHeader && snsTypeHeader !== envelope?.Type) {
      throw new SnsValidationError('SNS message type header does not match envelope');
    }
    const result = await trinksSnsHandler.handle(envelope);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof SnsValidationError) {
      console.warn('[trinks-sns] envelope rejeitado:', err.message);
      return res.status(401).json({ error: 'invalid_sns_envelope' });
    }
    console.error('[trinks-sns] processamento falhou:', err.message);
    return res.status(500).json({ error: 'trinks_webhook_failed' });
  }
});

// --- Webchat endpoint (demo / testes) ---
app.post('/webhook/demo-chat', withTimeout(async (req, res) => {
  const { message, session_id, contact_name = 'Visitante', history: incomingHistoryRaw } = req.body;
  const sessionId = String(session_id || 'anonymous');
  if (!message || !message.trim()) {
    return res.status(400).json({ response: 'Mensagem vazia', timestamp: new Date().toISOString() });
  }
  const result = await processMessage(sessionId, message.trim(), contact_name, incomingHistoryRaw, null, null);
  return res.json(result);
}, 28000));

// --- Kapso webhook (WhatsApp via QR code) ---
// --- Kapso API helpers (envio de mensagens) ---
// Webhooks Kapso sao notificacao — para responder ao cliente precisamos chamar a API.
// Endpoint proxia o Meta Cloud API: POST /meta/whatsapp/{ver}/{phone_number_id}/messages.
// Ultimo phone_number_id visto em webhooks Kapso — usado pelo Supervisor matinal
// (cron nao tem req pra extrair). Cache em memoria, refrescado a cada msg recebida.
let lastKnownKapsoPhoneNumberId = null;

// Timestamp do ultimo evento inbound de Tiago. Necessario pra monitorar a janela
// de 24h do WhatsApp Cloud API: bot so pode enviar mensagem livre pra um numero
// se houve mensagem dele nas ultimas 24h. Se essa janela expira sem nova msg do
// Tiago, notificacoes administrativas (after-hours, supervisor matinal) silenciam.
// Health endpoint expoe horas decorridas pra monitoramento externo.
let lastTiagoInboundAt = null;

const KAPSO_API_BASE = (process.env.KAPSO_API_BASE || 'https://api.kapso.ai').replace(/\/+$/, '');
const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_API_VERSION = process.env.KAPSO_API_VERSION || 'v24.0';

// Numero do dono/supervisor (Tiago) para receber notificacoes de handoff.
// Telefone na whitelist E ja em conversa ativa com o numero do salao,
// senao Meta bloqueia (janela 24h). Tiago manda msg diaria pra recepcao naturalmente.
const TIAGO_NOTIFICATION_PHONE = (process.env.TIAGO_NOTIFICATION_PHONE || '').replace(/\D/g, '');

// Notifica Tiago quando booking eh criado fora do horario comercial.
// Permite conferencia administrativa e intervencao manual.
async function notifyTiagoAfterHoursBooking({ booking, bookingResult, clientPhone, clientName, phoneNumberId, salonState }) {
  if (!TIAGO_NOTIFICATION_PHONE || !phoneNumberId) return;
  const valorFmt = (booking.valor ?? bookingResult?.valor ?? 0).toFixed(2).replace('.', ',');
  const dataFmt = booking.date && booking.time
    ? `${booking.date.split('-').reverse().join('/')} às ${booking.time}`
    : 'horario nao identificado';
  const text =
    `📅 Agendamento criado FORA do horario\n\n` +
    `Quando: ${dataFmt}\n` +
    `Cliente: ${clientName || 'sem nome'} (${clientPhone || '?'})\n` +
    `Servico: ${booking.service || `id ${booking.serviceId}`}\n` +
    `Profissional: ${booking.professional || `id ${booking.professionalId}`}\n` +
    `Valor: R$ ${valorFmt}\n` +
    `Trinks ID: #${bookingResult?.id || '?'}\n\n` +
    `Bot agendou fora do expediente (${salonState.reason}). Se quiser cancelar ou ajustar, abre o painel Trinks ou WhatsApp do cliente.`;
  try {
    await sendKapsoMessage(TIAGO_NOTIFICATION_PHONE, text, phoneNumberId);
    console.log(`[after-hours] notificado Tiago sobre booking #${bookingResult?.id} fora do horario`);
  } catch (err) {
    console.error(`[after-hours] falha ao notificar: ${err.message}`);
  }
}

async function notifyTiagoHandoff({ motivo, clientPhone, clientName, lastClientMsg, phoneNumberId }) {
  if (!TIAGO_NOTIFICATION_PHONE) {
    console.warn('[handoff] TIAGO_NOTIFICATION_PHONE nao configurado — notificacao pulada');
    return;
  }
  if (!phoneNumberId) {
    console.warn('[handoff] phone_number_id ausente — nao posso enviar via Kapso');
    return;
  }
  const phoneDigits = String(clientPhone || '').replace(/\D/g, '') || '?';
  const displayName = clientName && clientName !== 'Cliente' ? clientName : 'cliente';
  const sla = buildHandoffSlaPayload();
  const text =
    `🔔 Bot pediu sua atenção\n\n` +
    `Motivo: ${motivo || 'não especificado'}\n` +
    `Cliente: ${displayName}\n` +
    `Telefone: ${phoneDigits}\n` +
    `Última msg: "${(lastClientMsg || '').slice(0, 200)}"\n\n` +
    `${formatHandoffSlaNotice(sla)}\n\n` +
    `Para retomar a IA, responda AQUI neste chat:\n` +
    `retomar ${displayName}. <orientação 20–500 caracteres>\n\n` +
    `Ex.: retomar Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.\n\n` +
    `A IA está silenciosa na thread da cliente até você retomar.`;
  try {
    await sendKapsoMessage(TIAGO_NOTIFICATION_PHONE, text, phoneNumberId);
    console.log(`[handoff] notificacao enviada ao Tiago (${TIAGO_NOTIFICATION_PHONE}) — motivo: ${motivo}`);
  } catch (err) {
    console.error(`[handoff] falha ao notificar Tiago: ${err.message}`);
  }
}

// Delay entre bolhas quando uma resposta tem multiplos <break>.
// Simula tempo de digitacao humano. Configuravel via env (default 1100ms).
const BUBBLE_DELAY_MS = Math.max(0, Number(process.env.BUBBLE_DELAY_MS) || 1100);

// Envia uma unica bolha para a Kapso (sem split, sem delay).
// Helper interno usado por sendKapsoMessage.
async function sendKapsoSingle(to, text, phoneNumberId) {
  const url = `${KAPSO_API_BASE}/meta/whatsapp/${KAPSO_API_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': KAPSO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.text().catch(() => '');
  if (!res.ok) {
    console.error(`[kapso] send → ${res.status}: ${body.slice(0, 300)}`);
    return false;
  }
  console.log(`[kapso] send → ${res.status} para ${to}`);
  return true;
}

// Envia mensagem para a Kapso, com split tag-aware se o texto conter <break>.
// Comportamento:
//   - Texto sem <break>: send unico (zero overhead, identico ao comportamento anterior)
//   - Texto com <break>: split em bolhas, envia em sequencia com BUBBLE_DELAY_MS entre
//   - Tags inline ([BOOKING_*], [HANDOFF_*]) sempre integras (garantia do splitter)
async function sendKapsoMessage(to, text, phoneNumberId) {
  if (!KAPSO_API_KEY) {
    console.error('[kapso] KAPSO_API_KEY ausente — nao envio mensagem');
    return false;
  }
  if (!phoneNumberId) {
    console.error('[kapso] phone_number_id ausente — nao envio mensagem');
    return false;
  }
  const bubbles = collapseToKapsoSends(text);
  if (bubbles.length === 0) {
    console.warn('[kapso] sendKapsoMessage chamado com texto vazio — skip');
    return false;
  }
  for (let i = 0; i < bubbles.length; i++) {
    if (i > 0) await sleep(BUBBLE_DELAY_MS);
    const sent = await sendKapsoSingle(to, bubbles[i], phoneNumberId);
    if (!sent) return false;
  }
  return true;
}

/** Resume IA: falha se Kapso não enviar (503 kapso_send_failed). */
async function sendKapsoMessageStrict(to, text, phoneNumberId) {
  const ok = await sendKapsoMessage(to, text, phoneNumberId);
  if (!ok) throw new Error('kapso_send_failed');
}

function validateKapsoWebhookSignature(req, { secret, label = 'kapso' } = {}) {
  if (!secret) {
    console.warn(`[${label}] webhook secret not set — skipping HMAC validation (dev mode)`);
    return true;
  }
  // Doc Kapso (docs.kapso.ai): HMAC SHA256 hex sobre o body RAW (exatamente como recebido), header X-Webhook-Signature.
  // Aceita formato bare-hex (esperado pela doc) ou prefixado "sha256=hex" por defensividade.
  let signature = req.headers['x-webhook-signature'] || req.headers['x-kapso-signature'] || '';
  if (signature.startsWith('sha256=')) signature = signature.slice(7);

  // CRITICAL: usar req.rawBody (capturado em express.json verify, linha 87) ao inves de JSON.stringify(req.body).
  // JSON.stringify do parsed body produz string diferente do raw enviado por Kapso quando payload tem
  // ordem de chaves nao-canonica, escapes Unicode (\u00xx), ou floats com .0 — quebra HMAC em eventos
  // de audio/midia que tem campos extras. Fix de bug onde audio era rejeitado mas texto passava.
  const body = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (signature.length !== expected.length) {
    console.warn(`[${label}] HMAC length mismatch — sig=${signature.length}ch expected=${expected.length}ch. header raw="${(req.headers['x-webhook-signature'] || '').slice(0,32)}…"`);
    return false;
  }
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    if (!ok) console.warn(`[${label}] HMAC mismatch — sig=${signature.slice(0,16)}… expected=${expected.slice(0,16)}…`);
    return ok;
  } catch (e) {
    console.warn(`[${label}] HMAC error: ${e.message}`);
    return false;
  }
}

function validateKapsoSignature(req) {
  return validateKapsoWebhookSignature(req, {
    secret: process.env.KAPSO_WEBHOOK_SECRET,
    label: 'kapso',
  });
}

function validateKapsoMetaSignature(req) {
  return validateKapsoWebhookSignature(req, {
    secret: process.env.KAPSO_META_WEBHOOK_SECRET || process.env.KAPSO_WEBHOOK_SECRET,
    label: 'kapso-meta',
  });
}

function validateKapsoProjectSignature(req) {
  return validateKapsoWebhookSignature(req, {
    secret: process.env.KAPSO_PROJECT_WEBHOOK_SECRET || process.env.KAPSO_WEBHOOK_SECRET,
    label: 'kapso-project',
  });
}

const KAPSO_ACCOUNT_V2_NOTIFY_EVENTS = new Set([
  'whatsapp.account.disabled',
  'whatsapp.account.restricted',
  'whatsapp.account.violation',
]);

async function notifyTiagoKapsoAccountV2(evt) {
  if (!KAPSO_ACCOUNT_V2_NOTIFY_EVENTS.has(evt.event)) return;
  if (!TIAGO_NOTIFICATION_PHONE) {
    console.warn('[kapso-project] TIAGO_NOTIFICATION_PHONE nao configurado — notificacao pulada');
    return;
  }
  const phoneNumberId = lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    console.warn('[kapso-project] phone_number_id ausente — notificacao pulada');
    return;
  }
  if (!lastTiagoInboundAt) {
    console.warn('[kapso-project] janela 24h: nenhum inbound de Tiago registrado — notificacao pulada');
    return;
  }
  const hoursSince = (Date.now() - new Date(lastTiagoInboundAt).getTime()) / 3600000;
  if (hoursSince >= 24) {
    console.warn(`[kapso-project] janela 24h expirada (${hoursSince.toFixed(1)}h) — notificacao pulada`);
    return;
  }

  const shortEvent = evt.event.replace('whatsapp.account.', '');
  const phone = evt.phone_number || '?';
  const waba = evt.waba_id || '?';
  let detail = '';
  if (evt.event === 'whatsapp.account.disabled') {
    detail = evt.payload?.ban?.state ? `\nEstado: ${evt.payload.ban.state}` : '';
  } else if (evt.event === 'whatsapp.account.restricted') {
    const r = evt.payload?.restrictions?.[0];
    detail = r?.type ? `\nRestricao: ${r.type}` : '';
  } else if (evt.event === 'whatsapp.account.violation') {
    detail = evt.payload?.violation?.type ? `\nViolacao: ${evt.payload.violation.type}` : '';
  }

  const text =
    `⚠️ Alerta conta WhatsApp (${shortEvent})\n\n` +
    `WABA: ${waba}\nNumero: ${phone}${detail}\n\n` +
    `Verifique o painel Meta/Kapso e o Inbox do salao.`;

  try {
    await sendKapsoMessage(TIAGO_NOTIFICATION_PHONE, text, phoneNumberId);
    console.log(`[kapso-project] notificacao enviada ao Tiago — ${evt.event}`);
  } catch (err) {
    console.error(`[kapso-project] falha ao notificar Tiago: ${err.message}`);
  }
}

app.post('/webhook/kapso', withTimeout(async (req, res) => {
  // 1. Validacao de assinatura (rejeita antes de qualquer outro trabalho)
  if (!validateKapsoSignature(req)) {
    console.warn('[kapso] Invalid HMAC signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Normaliza payload: Kapso entrega bufferizado (batch=true, eventos em data[]) ou single (raiz).
  // Em batch, todos os eventos sao da mesma conversation no window — concatena os textos e processa
  // como uma unica entrada (que e o proposito do buffer).
  const events = (req.body?.batch && Array.isArray(req.body?.data)) ? req.body.data : [req.body];

  // Diagnostico: log origin/direction de TODAS as mensagens recebidas — auditoria de coexistencia.
  const summary = events.map(e => ({
    from: e?.message?.from,
    origin: e?.message?.kapso?.origin,
    direction: e?.message?.kapso?.direction,
    status: e?.message?.kapso?.status,
    type: e?.message?.type,
    preview: (e?.message?.kapso?.content || e?.message?.text?.body || '').slice(0, 40),
  }));
  console.log(`[kapso] events: ${JSON.stringify(summary)}`);

  // 3a. Takeover humano: outbound NAO-cloud_api (app, web, etc.) → marca conversa como human-handled.
  for (const e of events) {
    const m = e?.message;
    const dir = m?.kapso?.direction;
    const origin = m?.kapso?.origin;
    if (dir === 'outbound' && origin && origin !== 'cloud_api') {
      const targetPhone = e?.conversation?.phone_number || m?.to || m?.from;
      if (!isOwnerPhone(targetPhone)) {
        await markHumanHandled(targetPhone, 'business_app');
        await persistStaffOutbound(targetPhone);
      }
    }
  }

  // 3b. Echo de qualquer outbound (incluindo o nosso proprio bot via cloud_api): ignora — nao vamos responder a nos mesmos nem ao staff.
  const hasOutbound = events.some(e => e?.message?.kapso?.direction === 'outbound');
  if (hasOutbound) {
    console.log(`[kapso] outbound/echo ignorado (takeover ja registrado se aplicavel). summary=${JSON.stringify(summary)}`);
    return res.json({ ok: true });
  }

  // 3c. history_sync = mensagem antiga sendo importada, nao processar.
  if (events.some(e => e?.message?.kapso?.origin === 'history_sync')) {
    console.log(`[kapso] history_sync ignorado`);
    return res.json({ ok: true });
  }

  const firstMsg = events[0]?.message;
  const firstConv = events[0]?.conversation;

  // Detecta áudios no batch — transcrição acontece DEPOIS do res.json (background).
  const audioEvents = events.filter(e => e?.message?.type === 'audio' && e?.message?.audio?.id);

  // Concatena textos de todas as mensagens do batch (oi + tudo bem + audio transcrito etc.).
  // Filtra eventos de audio aqui — o kapso.content de audio contem "Audio attached ... Transcript: ..."
  // que duplicaria o texto quando o loop de transcricao depois prefixa "[AUDIO TRANSCRITO]: ...".
  // Audios sao processados separadamente via transcribeAudio (Kapso-primary, TESS-fallback) abaixo.
  let messageText = events
    .filter(e => e?.message?.type !== 'audio')
    .map(e => {
      const msg = e?.message;
      if (!msg) return '';
      const mediaNorm = normalizeKapsoMediaContent(e);
      if (mediaNorm) return mediaNorm;
      if (msg.type === 'text') return (msg.text?.body || '').trim();
      return (msg.text?.body || '').trim();
    })
    .filter(Boolean)
    .join('\n');

  const sessionId = firstConv?.phone_number || firstMsg?.from || 'unknown';
  // contact_name pode vir em conversation.contact_name (novo) ou conversation.kapso.contact_name (legado da doc)
  const contactName = firstConv?.contact_name || firstConv?.kapso?.contact_name || 'Cliente';
  const sessionPhone = String(sessionId).replace(/\D/g, '');
  const inboundTraceId = newTraceId();
  // phone_number_id da conexão Kapso deste inbound (número do BOT, não o da recepção 94831)
  const phoneNumberId = events[0]?.phone_number_id || firstConv?.phone_number_id || req.body?.phone_number_id;
  if (phoneNumberId) lastKnownKapsoPhoneNumberId = phoneNumberId;

  // Janela 24h WhatsApp: atualiza timestamp do ultimo evento inbound de Tiago.
  // Usa o sessionPhone — quando msg vem do telefone do Tiago (TIAGO_NOTIFICATION_PHONE),
  // significa que a janela esta saudavel pra notificacoes administrativas.
  if (TIAGO_NOTIFICATION_PHONE && sessionPhone === TIAGO_NOTIFICATION_PHONE) {
    lastTiagoInboundAt = new Date().toISOString();
  }

  // Permite entrada se há texto OU áudio pra transcrever
  if (sessionId === 'unknown' || (!messageText && audioEvents.length === 0)) {
    console.warn(`[kapso] payload sem phone/text/audio — sessionId=${sessionId} text="${(messageText||'').slice(0,50)}" batch=${req.body?.batch} eventCount=${events.length}`);
    return res.json({ ok: true });
  }

  // 3b. PASSIVE LOGGING — registra TODA mensagem antes do filtro de whitelist.
  // Razao: Supervisor matinal precisa ver mensagens de clientes reais para priorizar
  // a triagem do Tiago. Sem isso, conversation_history so tem msgs whitelisted (testes).
  // Marca como agent='passive' para distinguir das msgs efetivamente atendidas pelo bot.
  if (sessionPhone) {
    saveConversationTurns(sessionPhone, [
      { role: 'user', content: messageText, agent: 'passive' }
    ], inboundTraceId).catch(err => console.error('[passive-log] erro:', err.message));
  }

  // 4. Bot state via DB (Story 1.2-DATA): toggles + whitelist com cache 5s.
  // Fallback ao BOT_ALLOWED_PHONES/BOT_ACCEPT_ALL env se DB indisponível ou whitelist vazia.
  const botState = await getBotState();

  // 4a. Kill switch global (apenas se DB disponível)
  if (botState.toggles && botState.toggles.global === false) {
    console.log(`[kapso][${sessionId}] BOT GLOBAL DESLIGADO via DB — silencioso`);
    return res.json({ ok: true });
  }

  // 4b. Whitelist / denylist por número.
  // block e human_only valem mesmo com BOT_ACCEPT_ALL=true (OPEN).
  const phoneAccess = resolvePhoneAccess(sessionPhone, botState, {
    acceptAll: BOT_ACCEPT_ALL,
    allowedPhones: BOT_ALLOWED_PHONES,
  });
  if (phoneAccess.silent) {
    console.log(`[kapso][${sessionId}] phone ${sessionPhone} ${phoneAccess.reason} — bot inativo`);
    return res.json({ ok: true });
  }

  // 4b. Human takeover: se a conversa foi marcada como human-handled, bot fica calado ate o TTL.
  // Dono (Tiago): nunca silenciar — ele comanda a IA neste número.
  if (await isHumanHandled(sessionPhone) && !isOwnerPhone(sessionPhone)) {
    console.log(`[kapso][${sessionId}] conversa human-handled — bot silencioso (TTL ${HUMAN_HANDLED_TTL_MS / 3600000}h)`);
    return res.json({ ok: true });
  }

  console.log(`[kapso][${sessionId}] message recebida: "${messageText.slice(0, 80)}" pnid=${phoneNumberId}`);

  // 5. Webhook ack imediato — Kapso nao le o body como mensagem.
  // O envio acontece via chamada separada a API do Kapso depois do TESS.
  res.json({ ok: true });

  // Victor 2026-09-03: duplicar é aceitável. Watchdog só no caminho que deveria falar.
  // Kill/allowlist/human-handled já retornaram acima — não acordam o cliente.
  const outboxWaitMs = Math.max(5_000, Number(process.env.OUTBOX_WAIT_MS) || 45_000);
  const outbox = isOwnerPhone(sessionPhone)
    ? { markFinal() {}, async fail() { return { skipped: true }; } }
    : startOutboundWatchdog({
        phone: sessionPhone,
        sessionId,
        phoneNumberId,
        waitMs: outboxWaitMs,
        sendFn: sendKapsoMessage,
        emitEvent: (evt) => emitOperationalEvent(db, evt),
      });

  try {
    // 5b. Transcrição de áudio em background. Bot avisa "vou escutar" antes,
    // transcreve via TESS, e concatena ao messageText antes do processMessage.
    if (audioEvents.length > 0) {
      await sendKapsoMessage(sessionId, `Recebi seu áudio${audioEvents.length > 1 ? 's' : ''}! Vou escutar 🎧`, phoneNumberId)
        .catch(err => console.error('[audio] msg ponte falhou:', err.message));
      const transcriptions = [];
      const failures = [];
      for (const e of audioEvents) {
        const mediaId = e.message.audio.id;
        // kapso.content normalmente vem com "Transcript: <texto>" — caminho primário (zero custo).
        // Se ausente, transcribeAudio cai no fallback TESS.
        const kapsoContent = e?.message?.kapso?.content;
        try {
          const t = await transcription.transcribeAudio({ mediaId, phoneNumberId, kapsoContent });
          transcriptions.push(t.text);
          const sizeInfo = t.bytes ? ` (${t.bytes}b)` : '';
          console.log(`[audio] transcrito via ${t.source} ${mediaId}${sizeInfo}: "${t.text.slice(0, 100)}"`);
        } catch (err) {
          console.error(`[audio] transcricao falhou ${mediaId}: ${err.code || ''} ${err.message}`);
          failures.push({ mediaId, code: err.code });
        }
      }
      // Anexa transcrições ao messageText como blocos extras prefixados.
      for (const t of transcriptions) {
        messageText = messageText ? `${messageText}\n[AUDIO TRANSCRITO]: ${t}` : `[AUDIO TRANSCRITO]: ${t}`;
      }
      // Se tudo era áudio e tudo falhou, manda mensagem honesta e encerra.
      if (transcriptions.length === 0 && !messageText.trim()) {
        const reason = failures.some(f => f.code === 'transcription_not_configured')
          ? 'Ainda não consigo escutar áudios por aqui 😅 Pode me mandar por texto?'
          : 'Tive um problema pra escutar seu áudio. Pode mandar por texto?';
        await sendKapsoMessage(sessionId, reason, phoneNumberId)
          .catch(err => console.error('[audio] msg de falha falhou:', err.message));
        outbox.markFinal();
        return;
      }
    }

    const kapsoConversationId = firstConv?.id || events[0]?.conversation_id || null;

    // Owner resume parser (story resume-ia-3): âncora estreita ANTES de processMessage do dono.
    if (shouldAttemptOwnerResume(isOwnerPhone(sessionPhone), messageText)) {
      await handleOwnerResumeInbound({
        messageText,
        db,
        resumeDeps: {
          db,
          getBotState,
          resolvePhoneAccess,
          emitOperationalEvent,
          runOperatorResumeTurn,
          sendKapsoMessage: sendKapsoMessageStrict,
          getKapsoPhoneNumberId: () => lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID,
          markHumanHandled,
          envAcceptAll: BOT_ACCEPT_ALL,
          envAllowedPhones: BOT_ALLOWED_PHONES,
        },
        sendAck: async (ackText) => {
          if (!TIAGO_NOTIFICATION_PHONE) {
            console.warn('[owner-resume] TIAGO_NOTIFICATION_PHONE ausente — ack pulado');
            return;
          }
          await sendKapsoMessage(TIAGO_NOTIFICATION_PHONE, ackText, phoneNumberId);
        },
      });
      outbox.markFinal();
      return;
    }

    const result = await processMessage(sessionId, messageText, contactName, null, sessionId, kapsoConversationId, inboundTraceId);
    const blocks = result.responses?.length ? result.responses : [result.response];
    let sentAny = false;
    for (const block of blocks) {
      if (block && block.trim()) {
        const ok = await sendKapsoMessage(sessionId, block, phoneNumberId);
        if (ok) sentAny = true;
      }
    }
    if (sentAny) outbox.markFinal();
    else await outbox.fail('blocos_vazios');
    // Handoff: notifica Tiago em WhatsApp interno (numero ja na whitelist e em conversa ativa).
    if (result.handoff) {
      notifyTiagoHandoff({
        motivo: result.handoff.motivo,
        clientPhone: sessionId,
        clientName: contactName,
        lastClientMsg: messageText,
        phoneNumberId,
      }).catch(err => console.error(`[handoff] erro:`, err.message));
    }
    // After-hours booking: notifica Tiago para conferencia administrativa.
    if (result.afterHoursBooking) {
      notifyTiagoAfterHoursBooking({
        ...result.afterHoursBooking,
        clientName: contactName,
        phoneNumberId,
      }).catch(err => console.error(`[after-hours] erro:`, err.message));
    }
  } catch (err) {
    console.error(`[kapso][${sessionId}] erro processando/enviando:`, err.message);
    await outbox.fail('catch_sem_outbound');
  }
}, 28000));

// --- Kapso meta webhook (raw Meta payloads, incl. account_update / PARTNER_REMOVED) ---
// Um webhook kind=meta por phone_number_id na Kapso. Meta recomenda monitorar account_update
// quando a conta fica presa em coexistencia ou ao desconectar do Cloud API.
app.post('/webhook/kapso-meta', withTimeout(async (req, res) => {
  if (!validateKapsoMetaSignature(req)) {
    console.warn('[kapso-meta] Invalid HMAC signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ ok: true });

  try {
    const result = await handleMetaAccountUpdates(db, req.body, 'kapso-meta');
    if (result.handled) {
      console.log(`[kapso-meta] account_update processed count=${result.events.length} inserted=${result.inserted}`);
    }
  } catch (err) {
    console.error('[kapso-meta] erro ao processar account_update:', err.message);
  }
}, 5000));

// --- Kapso project webhook (platform events v2: whatsapp.account.*) ---
// Integrations → Webhooks → Platform webhooks no projeto Kapso. Separado de /webhook/kapso (mensagens).
app.post('/webhook/kapso-project', withTimeout(async (req, res) => {
  if (!validateKapsoProjectSignature(req)) {
    console.warn('[kapso-project] Invalid HMAC signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const previewEvent = req.body?.event
    || (Array.isArray(req.body?.data) ? req.body.data[0]?.event : null)
    || 'unknown';

  res.json({ ok: true });

  try {
    const result = await handleKapsoAccountV2Events(db, req.body);
    if (!result.handled) {
      console.log(`[kapso-project] non-account event ignored: ${previewEvent}`);
      return;
    }
    console.log(`[kapso-project] account v2 processed count=${result.events.length} inserted=${result.inserted}`);
    for (const evt of result.events) {
      notifyTiagoKapsoAccountV2(evt).catch(err => {
        console.error(`[kapso-project] erro ao notificar Tiago: ${err.message}`);
      });
    }
  } catch (err) {
    console.error('[kapso-project] erro ao processar account v2:', err.message);
  }
}, 5000));

// --- Meta Cloud API webhook (WhatsApp direto pela Meta, sem intermediario) ---
// Diferenca-chave vs Kapso: a Meta NAO le o corpo da resposta HTTP. Exige 200 rapido
// e a resposta ao cliente vai por uma chamada separada a Graph API.
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'studio-tirra-verify-2026';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

// Dedupe de message IDs — a Meta reenvia o mesmo webhook se nao receber 200 a tempo
const processedMetaMessages = new Set();
function markMetaMessageProcessed(id) {
  processedMetaMessages.add(id);
  if (processedMetaMessages.size > 1000) {
    processedMetaMessages.delete(processedMetaMessages.values().next().value);
  }
}

function validateMetaSignature(req) {
  if (!META_APP_SECRET) {
    console.warn('[meta] META_APP_SECRET nao definido — pulando validacao de assinatura (dev mode)');
    return true;
  }
  const signature = req.headers['x-hub-signature-256'] || '';
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Envia mensagem de texto via Graph API
async function sendMetaMessage(to, text) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.error('[meta] META_ACCESS_TOKEN ou META_PHONE_NUMBER_ID ausente — nao e possivel responder');
    return;
  }
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.text().catch(() => '');
  if (!res.ok) console.error(`[meta] send → ${res.status}: ${data}`);
  else console.log(`[meta] send → ${res.status} para ${to}`);
}

// GET — handshake de verificacao do webhook (Meta envia hub.challenge na configuracao)
app.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[meta] webhook verificado com sucesso');
    return res.status(200).send(challenge);
  }
  console.warn('[meta] verificacao falhou — verify_token invalido');
  return res.sendStatus(403);
});

// POST — recebe mensagens do WhatsApp via Meta Cloud API
app.post('/webhook/meta', async (req, res) => {
  if (!validateMetaSignature(req)) {
    console.warn('[meta] assinatura X-Hub-Signature-256 invalida — rejeitado');
    return res.sendStatus(401);
  }

  // Responde 200 imediatamente — o TESS leva 10-30s, processamento acontece depois.
  res.sendStatus(200);

  try {
    const accountResult = await handleMetaAccountUpdates(db, req.body, 'meta-direct');
    if (accountResult.handled) {
      console.log(`[meta] account_update processed count=${accountResult.events.length} inserted=${accountResult.inserted}`);
    }

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    // Ignora status updates (sent/delivered/read) — esses payloads nao tem value.messages
    if (!msg) return;

    // Meta-direto: mídia com caption → marcador; demais tipos não-texto só logam
    if (msg.type !== 'text') {
      const mediaNorm = normalizeKapsoMediaContent({ message: msg });
      if (!mediaNorm) {
        console.log(`[meta] mensagem tipo "${msg.type}" ignorada (sem texto normalizado)`);
        return;
      }
      console.log(`[meta] mensagem tipo "${msg.type}" normalizada: "${mediaNorm.slice(0, 80)}"`);
      const from = msg.from;
      const contactName = value?.contacts?.[0]?.profile?.name || 'Cliente';
      const messageText = mediaNorm;

      if (processedMetaMessages.has(msg.id)) {
        console.log(`[meta] mensagem ${msg.id} ja processada — ignorada`);
        return;
      }
      markMetaMessageProcessed(msg.id);

      console.log(`[meta][${from}] message recebida: "${messageText.slice(0, 80)}"`);

      const result = await processMessage(from, messageText, contactName, null, from, null);
      const blocks = result.responses?.length ? result.responses : [result.response];
      for (const block of blocks) {
        if (block && block.trim()) await sendMetaMessage(from, block);
      }
      return;
    }

    const from = msg.from; // wa_id, ex: 5511999999999
    const messageText = (msg.text?.body || '').trim();
    const contactName = value?.contacts?.[0]?.profile?.name || 'Cliente';

    if (processedMetaMessages.has(msg.id)) {
      console.log(`[meta] mensagem ${msg.id} ja processada — ignorada`);
      return;
    }
    markMetaMessageProcessed(msg.id);

    console.log(`[meta][${from}] message recebida: "${messageText.slice(0, 80)}"`);
    if (!messageText) return;

    const result = await processMessage(from, messageText, contactName, null, from, null);

    // Envia cada bloco do WhatsApp como mensagem separada
    const blocks = result.responses?.length ? result.responses : [result.response];
    for (const block of blocks) {
      if (block && block.trim()) await sendMetaMessage(from, block);
    }
  } catch (err) {
    console.error('[meta] erro ao processar mensagem:', err.message);
  }
});

// --- Supervisor matinal (Fase 2) ---
const supervisor = require('./supervisor');
// --- Transcrição de áudio (Fase 3) ---
const transcription = require('./transcription');

// Endpoint admin para disparar triagem manualmente. Protegido por header simples.
// Uso: curl -X POST -H "X-Admin-Token: $ADMIN_TOKEN" https://.../admin/trigger-supervisor?dryRun=1
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Cache do ultimo digest gerado (em memoria) para inspecao via GET /admin/last-digest
let lastSupervisorRun = null;

app.post('/admin/trigger-supervisor', (req, res) => {
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const isDryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  // Responde imediato — pipeline roda em background (pode demorar minutos com
  // muitas conversas, e nginx tem timeout default de 60s).
  res.status(202).json({
    ok: true,
    accepted: true,
    dry_run: isDryRun,
    message: 'Triagem iniciada em background. Use GET /admin/last-digest para ver resultado.',
  });
  supervisor.runMorningTriage({
    sendKapsoMessage,
    kapsoPhoneNumberId: lastKnownKapsoPhoneNumberId,
    isDryRun,
  })
    .then(result => {
      lastSupervisorRun = {
        timestamp: new Date().toISOString(),
        dry_run: isDryRun,
        ranked_count: result.ranked.length,
        lookback_hours: result.lookbackHours,
        digest_text: result.text,
        ranked: result.ranked,
      };
      console.log(`[admin] triagem concluida — ${result.ranked.length} itens, dryRun=${isDryRun}`);
    })
    .catch(err => {
      console.error('[admin] trigger-supervisor erro:', err.message);
      lastSupervisorRun = { timestamp: new Date().toISOString(), error: err.message };
    });
});

app.get('/admin/last-digest', (req, res) => {
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!lastSupervisorRun) {
    return res.json({ ok: true, status: 'no run yet' });
  }
  return res.json({ ok: true, ...lastSupervisorRun });
});

app.post('/admin/conversations/:phone/resume', async (req, res) => {
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { note, actor, force } = req.body || {};
  try {
    const result = await resumeConversation(req.params.phone, { note, actor, force }, {
      db,
      getBotState,
      resolvePhoneAccess,
      emitOperationalEvent,
      runOperatorResumeTurn,
      sendKapsoMessage: sendKapsoMessageStrict,
      getKapsoPhoneNumberId: () => lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID,
      markHumanHandled,
      envAcceptAll: BOT_ACCEPT_ALL,
      envAllowedPhones: BOT_ALLOWED_PHONES,
    });
    return res.status(result.httpStatus).json(result.body);
  } catch (err) {
    console.error('[admin] resume erro:', err.message);
    return res.status(503).json({ error: 'internal_error' });
  }
});

// Inicia o scheduler do supervisor (cron interno, checa 7h ter-sab fuso salao)
supervisor.startScheduler({
  sendKapsoMessage,
  getKapsoPhoneNumberId: () => lastKnownKapsoPhoneNumberId,
});

// --- Monitor de cota Trinks (story quota-monitor) ---
// Alerta no WhatsApp ao cruzar thresholds da cota mensal, pra decidir comprar +5.000 (R$60) ou esperar o mês virar.
const TRINKS_ALERT_PHONES = (process.env.TRINKS_ALERT_PHONES || '')
  .split(',').map(s => s.trim().replace(/\D/g, '')).filter(Boolean);
const TRINKS_ALERT_THRESHOLDS = [6000, 7500, 8200, 8500];
const TRINKS_QUOTA_CHECK_MS = (parseInt(process.env.TRINKS_QUOTA_CHECK_MIN || '10', 10)) * 60 * 1000;
let _quotaAlertState = { month: null, alerted: new Set() };

async function checkTrinksQuota() {
  const usage = await getRequestBudget(db, {
    budget: TRINKS_MONTHLY_BUDGET,
    operationalCap: TRINKS_OPERATIONAL_CAP,
  });
  if (_quotaAlertState.month !== usage.month) _quotaAlertState = { month: usage.month, alerted: new Set() };
  const toAlert = newlyCrossed(usage.effective_used, TRINKS_ALERT_THRESHOLDS, _quotaAlertState.alerted);
  if (!toAlert.length) return;
  toAlert.forEach(t => _quotaAlertState.alerted.add(t));
  const pctLabel = Math.round((usage.effective_used / usage.budget) * 100);
  const atLimit = Math.max(...toAlert) >= TRINKS_OPERATIONAL_CAP;
  const msg = `⚠️ Cota Trinks: ${usage.effective_used}/${usage.budget} (${pctLabel}%) em ${usage.month}. Restam ${usage.remaining_to_cap} ate o teto operacional. `
    + (atLimit
      ? 'TETO OPERACIONAL ATINGIDO — novas chamadas foram bloqueadas pelo circuit breaker.'
      : `Modo atual: ${usage.mode}.`);
  console.warn('[trinks-quota] ' + msg);
  // fallback: lastKnownKapsoPhoneNumberId é null até o 1º inbound pós-restart; worker pode cruzar limite em janela quieta
  const pnid = lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID;
  if (pnid && TRINKS_ALERT_PHONES.length) {
    for (const phone of TRINKS_ALERT_PHONES) {
      sendKapsoMessage(phone, msg, pnid).catch(e => console.error('[trinks-quota] alerta falhou:', e.message));
    }
  } else {
    console.warn('[trinks-quota] sem TRINKS_ALERT_PHONES ou phone_number_id — alerta só no log');
  }
}
const trinksQuotaTimer = setInterval(
  () => { checkTrinksQuota().catch(e => console.error('[trinks-quota] check erro:', e.message)); },
  TRINKS_QUOTA_CHECK_MS,
);
trinksQuotaTimer.unref();

// --- Monitor de créditos TESS (story tess-context-on-demand) ---
// Alerta no WhatsApp quando o remaining da CARTEIRA cai — não bloqueia callTESS.
// Não usa TESS_CREDIT_BUDGET − used local (isso avisava ~400 com ~900 na conta).
const TESS_CREDIT_BUDGET = parseFloat(process.env.TESS_CREDIT_BUDGET || '1000');
const TESS_ALERT_REMAINING_THRESHOLDS = (process.env.TESS_ALERT_REMAINING_THRESHOLDS || '500,200,50')
  .split(',')
  .map(s => parseFloat(s.trim()))
  .filter(n => Number.isFinite(n) && n >= 0);
const TESS_ALERT_PHONES_RAW = (process.env.TESS_ALERT_PHONES || '')
  .split(',').map(s => s.trim().replace(/\D/g, '')).filter(Boolean);
const TESS_ALERT_PHONES = TESS_ALERT_PHONES_RAW.length
  ? TESS_ALERT_PHONES_RAW
  : (TRINKS_ALERT_PHONES.length
    ? TRINKS_ALERT_PHONES
    : (TIAGO_NOTIFICATION_PHONE ? [TIAGO_NOTIFICATION_PHONE] : []));
const TESS_CREDIT_CHECK_MS = (parseInt(process.env.TESS_CREDIT_CHECK_MIN || '10', 10)) * 60 * 1000;

const TESS_CREDIT_REMAINING_PATHS = (process.env.TESS_CREDIT_REMAINING_PATHS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

async function fetchTessAccountForAlerts(day) {
  if (!tessWorkspaceConfigured()) return null;
  return fetchTessAccountSnapshot({
    fetchFn: fetch,
    authHeaders: tessAuthHeaders(),
    apiBase: TESS_API_BASE,
    workspaceId: tessWorkspaceId(),
    day,
    remainingPaths: TESS_CREDIT_REMAINING_PATHS,
  });
}

async function readTessCreditUsage() {
  return getTessCreditUsage(db, TESS_CREDIT_BUDGET, () => new Date(), {
    accountFetcher: fetchTessAccountForAlerts,
  });
}

async function checkTessCredits() {
  const usage = await readTessCreditUsage();
  if (usage.account_remaining == null) {
    console.warn(
      `[tess-credits] remaining da carteira TESS indisponível na API — alerta WhatsApp omitido `
      + `(used local ${usage.credits_used.toFixed(2)}, API used ${usage.account_used ?? 'n/d'})`,
    );
    await saveCreditAlertState(db, {
      day: usage.day,
      alertedThresholds: usage.alerted_thresholds || [],
      accountUsed: usage.account_used,
      accountRemaining: null,
    });
    return;
  }
  const alerted = new Set(usage.alerted_thresholds || []);
  const toAlert = newlyDropped(usage.account_remaining, TESS_ALERT_REMAINING_THRESHOLDS, alerted);
  if (!toAlert.length) {
    await saveCreditAlertState(db, {
      day: usage.day,
      alertedThresholds: [...alerted],
      accountUsed: usage.account_used,
      accountRemaining: usage.account_remaining,
    });
    return;
  }
  toAlert.forEach((t) => alerted.add(t));
  await saveCreditAlertState(db, {
    day: usage.day,
    alertedThresholds: [...alerted],
    accountUsed: usage.account_used,
    accountRemaining: usage.account_remaining,
  });
  const threshold = Math.min(...toAlert);
  const msg = formatTessCreditAlert({
    day: usage.day,
    accountRemaining: usage.account_remaining,
    accountUsed: usage.account_used,
    calls: usage.calls,
    threshold,
  });
  console.warn('[tess-credits] ' + msg);
  const pnid = lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID;
  if (pnid && TESS_ALERT_PHONES.length) {
    for (const phone of TESS_ALERT_PHONES) {
      sendKapsoMessage(phone, msg, pnid).catch(e => console.error('[tess-credits] alerta falhou:', e.message));
    }
  } else {
    console.warn('[tess-credits] sem TESS_ALERT_PHONES (ou fallback) ou phone_number_id — alerta só no log');
  }
}
const tessCreditTimer = setInterval(
  () => { checkTessCredits().catch(e => console.error('[tess-credits] check erro:', e.message)); },
  TESS_CREDIT_CHECK_MS,
);
tessCreditTimer.unref();

const trinksConsumptionTimer = setInterval(() => {
  trinksApi.refreshConsumption()
    .catch(e => console.error('[trinks-consumption] refresh erro:', e.message));
}, 6 * 60 * 60 * 1000);
trinksConsumptionTimer.unref();

// Health check
app.get('/health', async (req, res) => {
  // Postgres ping (Story 1.7 AC6) — atualiza globalLastOkAt em sucesso
  try {
    const r = await db.query('SELECT 1');
    if (r) globalLastOkAt = new Date().toISOString();
  } catch (_e) {
    // mantem valor anterior; ausencia de DATABASE_URL faz query() retornar null sem throw
  }

  // Trinks ping (Story 1.7 AC7) — cache 60s, isolado por try/catch interno
  const trinks_ping = await pingTrinks();
  const requestBudget = await getRequestBudget(db, {
    budget: TRINKS_MONTHLY_BUDGET,
    operationalCap: TRINKS_OPERATIONAL_CAP,
  });
  const providerUsed = requestBudget.provider?.consistent
    ? Number(requestBudget.provider.total_used || 0)
    : null;
  const trinks_usage = {
    ...requestBudget,
    used: requestBudget.effective_used,
    remaining: requestBudget.remaining_to_cap,
    pct: requestBudget.budget > 0
      ? requestBudget.effective_used / requestBudget.budget
      : 0,
    official_used: providerUsed,
    divergence: providerUsed === null
      ? null
      : requestBudget.local_consumed - providerUsed,
  };
  const tess_credits = await readTessCreditUsage();
  let trinks_webhook = {
    configured: Boolean(TRINKS_SNS_TOPIC_ARN),
    last_received_at: null,
    last_processed_at: null,
    pending_notifications: 0,
    last_error: null,
  };
  let trinks_snapshots = {
    professionals: 0,
    services: 0,
    compatibility_pairs: 0,
    available_slots: 0,
    clients: 0,
    latest_sync_at: null,
  };
  try {
    const webhookResult = await db.query(
      `SELECT MAX(received_at) AS last_received_at,
              MAX(processed_at) FILTER (
                WHERE processing_status = 'processed'
              ) AS last_processed_at,
              (ARRAY_AGG(topic_arn ORDER BY processed_at DESC)
                FILTER (
                  WHERE message_type = 'SubscriptionConfirmation'
                    AND processing_status = 'processed'
                ))[1] AS confirmed_topic_arn,
              COUNT(*) FILTER (
                WHERE message_type = 'Notification' AND processing_status = 'processing'
              )::int AS pending_notifications,
              (ARRAY_AGG(error ORDER BY received_at DESC)
                FILTER (
                  WHERE error IS NOT NULL
                    AND received_at >= NOW() - INTERVAL '24 hours'
                ))[1] AS last_error
         FROM trinks_webhook_events`,
    );
    if (webhookResult?.rows?.[0]) {
      const { confirmed_topic_arn: confirmedTopicArn, ...webhookMetrics } = webhookResult.rows[0];
      trinks_webhook = {
        ...trinks_webhook,
        ...webhookMetrics,
        configured: Boolean(TRINKS_SNS_TOPIC_ARN || confirmedTopicArn),
      };
    }
  } catch (_) {
    // Health continua disponivel antes da migration.
  }
  try {
    const snapshotResult = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM trinks_professionals
           WHERE active AND deleted_at IS NULL) AS professionals,
         (SELECT COUNT(*)::int FROM trinks_services
           WHERE active AND deleted_at IS NULL) AS services,
         (SELECT COUNT(*)::int FROM trinks_service_professionals
           WHERE active) AS compatibility_pairs,
         (SELECT COUNT(*)::int FROM trinks_slots
           WHERE available AND starts_at >= NOW()) AS available_slots,
         (SELECT COUNT(*)::int FROM trinks_clients
           WHERE active AND deleted_at IS NULL) AS clients,
         GREATEST(
           (SELECT MAX(synced_at) FROM trinks_professionals),
           (SELECT MAX(synced_at) FROM trinks_services),
           (SELECT MAX(synced_at) FROM trinks_slots),
           (SELECT MAX(synced_at) FROM trinks_clients)
         ) AS latest_sync_at`,
    );
    if (snapshotResult?.rows?.[0]) trinks_snapshots = snapshotResult.rows[0];
  } catch (_) {
    // Health continua disponivel antes da migration.
  }
  let whatsapp_account_events = {
    table_ready: false,
    last_event: null,
    last_partner_removed_at: null,
    last_v2_event: null,
    last_v2_event_at: null,
    recent_count_24h: 0,
  };
  try {
    const accountResult = await db.query(
      `SELECT
         (SELECT event FROM whatsapp_account_events ORDER BY received_at DESC LIMIT 1) AS last_event,
         (SELECT MAX(received_at) FROM whatsapp_account_events
           WHERE event = 'PARTNER_REMOVED') AS last_partner_removed_at,
         (SELECT event FROM whatsapp_account_events
           WHERE source = 'kapso-v2' ORDER BY received_at DESC LIMIT 1) AS last_v2_event,
         (SELECT MAX(received_at) FROM whatsapp_account_events
           WHERE source = 'kapso-v2') AS last_v2_event_at,
         (SELECT COUNT(*)::int FROM whatsapp_account_events
           WHERE received_at >= NOW() - INTERVAL '24 hours') AS recent_count_24h`,
    );
    if (accountResult?.rows?.[0]) {
      whatsapp_account_events = {
        table_ready: true,
        ...accountResult.rows[0],
      };
    }
  } catch (_) {
    // Health continua disponivel antes da migration 008.
  }

  let human_handled = {
    table_ready: false,
    active_count: 0,
    ttl_hours: HUMAN_HANDLED_TTL_MS / 3600000,
  };
  try {
    const activeCount = await countActiveSilenced();
    if (activeCount !== null) {
      human_handled = {
        table_ready: true,
        active_count: activeCount,
        ttl_hours: HUMAN_HANDLED_TTL_MS / 3600000,
      };
    } else {
      console.warn('[health] bot_thread_state unavailable — human_handled.active_count degraded');
    }
  } catch (_) {
    // Health continua disponivel antes da migration 016.
  }

  res.json({
    status: 'ok',
    service: 'studio-tirra-webchat',
    uptime: process.uptime(),
    tess: {
      agent_id: TESS_AGENT_ID,
      url: TESS_URL,
      workspace_configured: tessWorkspaceConfigured(),
    },
    postgres: {
      pool: db.getPoolStats(),
      uptime_seconds: process.uptime(),
      last_ok_query_at: globalLastOkAt,
    },
    trinks_ping,
    trinks_webhook,
    trinks_snapshots,
    trinks_usage,
    tess_credits: {
      day: tess_credits.day,
      used: tess_credits.account_used != null
        ? tess_credits.account_used
        : tess_credits.credits_used,
      local_used: tess_credits.credits_used,
      calls: tess_credits.calls,
      budget: tess_credits.budget,
      pct: tess_credits.pct,
      remaining: tess_credits.account_remaining,
      remaining_source: tess_credits.account_remaining != null ? 'account' : tess_credits.remaining_source,
      account_used: tess_credits.account_used,
      account_remaining: tess_credits.account_remaining,
    },
    bot: {
      accept_all: BOT_ACCEPT_ALL,
      whitelist_count: BOT_ALLOWED_PHONES.length,
      mode: BOT_ACCEPT_ALL ? 'OPEN' : (BOT_ALLOWED_PHONES.length === 0 ? 'SILENT' : 'WHITELIST'),
      whitelist_source: 'see /admin/api/whitelist (Story 1.2-DATA cutover in progress)',
      human_handled,
    },
    meta: {
      configured: Boolean(META_ACCESS_TOKEN && META_PHONE_NUMBER_ID),
      phone_number_id: META_PHONE_NUMBER_ID ? 'set' : 'PENDENTE',
      verify_token: META_VERIFY_TOKEN ? 'set' : 'PENDENTE',
      app_secret: META_APP_SECRET ? 'set' : 'PENDENTE',
    },
    whatsapp_account_events,
    kapso: {
      phone_number_id: process.env.KAPSO_PHONE_NUMBER_ID ? 'set' : 'PENDENTE',
      inbound_cache_warm: Boolean(lastKnownKapsoPhoneNumberId),
    },
    kapso_meta_webhook: {
      endpoint: '/webhook/kapso-meta',
      secret_env: process.env.KAPSO_META_WEBHOOK_SECRET ? 'KAPSO_META_WEBHOOK_SECRET' : (
        process.env.KAPSO_WEBHOOK_SECRET ? 'KAPSO_WEBHOOK_SECRET (fallback)' : 'PENDENTE'
      ),
    },
    kapso_project_webhook: {
      endpoint: '/webhook/kapso-project',
      secret_env: process.env.KAPSO_PROJECT_WEBHOOK_SECRET ? 'KAPSO_PROJECT_WEBHOOK_SECRET' : (
        process.env.KAPSO_WEBHOOK_SECRET ? 'KAPSO_WEBHOOK_SECRET (fallback)' : 'PENDENTE'
      ),
    },
    whatsapp_window: (() => {
      // Status da janela 24h pro telefone do Tiago (canal de notificacoes admin).
      // green   = < 18h desde ultima inbound  -> margem confortavel
      // yellow  = 18h <= delta < 22h         -> precisa de uma msg do Tiago em breve
      // red     = >= 22h ou nunca recebido   -> janela quase fechando, alertar
      if (!TIAGO_NOTIFICATION_PHONE) return { configured: false };
      if (!lastTiagoInboundAt) {
        return {
          configured: true,
          last_inbound_at: null,
          hours_since: null,
          status: 'red',
          reason: 'Nenhum inbound de Tiago registrado desde restart do backend.',
        };
      }
      const hoursSince = (Date.now() - new Date(lastTiagoInboundAt).getTime()) / 3600000;
      let status = 'green';
      if (hoursSince >= 22) status = 'red';
      else if (hoursSince >= 18) status = 'yellow';
      return {
        configured: true,
        last_inbound_at: lastTiagoInboundAt,
        hours_since: Number(hoursSince.toFixed(2)),
        status,
      };
    })(),
  });
});

mountNightwatchMcp(app, {
  getToken: () => process.env.NIGHTWATCH_MCP_TOKEN || process.env.ADMIN_TOKEN || '',
  db,
  ops: nightwatchOps,
  getHealthLite: async () => {
    const trinks_ping = await pingTrinks();
    const tess_credits = await readTessCreditUsage();
    return {
      tess_agent: TESS_AGENT_ID,
      accept_all: BOT_ACCEPT_ALL,
      mode: BOT_ACCEPT_ALL ? 'OPEN' : (BOT_ALLOWED_PHONES.length === 0 ? 'SILENT' : 'WHITELIST'),
      trinks_ping: {
        status: trinks_ping.status,
        latency_ms: trinks_ping.latency_ms,
        cached: Boolean(trinks_ping.cached),
      },
      tess_credits: {
        remaining: tess_credits.account_remaining,
        remaining_source: tess_credits.account_remaining != null ? 'account' : tess_credits.remaining_source,
      },
    };
  },
});

// --- Start ---
const port = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`\n🚀 Studio Tirra Webchat Backend`);
    console.log(`   POST http://localhost:${port}/webhook/demo-chat`);
    console.log(`   POST http://localhost:${port}/webhook/kapso`);
    console.log(`   POST http://localhost:${port}/webhook/trinks`);
    console.log(`   GET/POST http://localhost:${port}/webhook/meta`);
    console.log(`   GET  http://localhost:${port}/health`);
    console.log(`   POST http://localhost:${port}/mcp (Nightwatch)\n`);
    console.log(`   TESS agent: ${TESS_AGENT_ID}`);
    const botMode = BOT_ACCEPT_ALL ? 'OPEN (responde todos)' : (BOT_ALLOWED_PHONES.length === 0 ? 'SILENT (whitelist vazia)' : `WHITELIST (${BOT_ALLOWED_PHONES.length} telefone(s))`);
    console.log(`   Bot mode: ${botMode}`);
    if (!TESS_TOKEN) console.warn('⚠️  TESS_API_TOKEN not set!');
    if (!tessWorkspaceConfigured()) console.warn('⚠️  TESS_WORKSPACE_ID not set! Tess API exigirá x-workspace-id em 01/09/2026.');
    if (!TRINKS_KEY) console.warn('⚠️  TRINKS_API_KEY not set!');
    if (!TRINKS_SNS_TOPIC_ARN && !TRINKS_SNS_BOOTSTRAP) {
      console.warn('⚠️  TRINKS_SNS_TOPIC_ARN not set!');
    }
    if (TRINKS_SNS_BOOTSTRAP) {
      console.warn('⚠️  TRINKS_SNS_BOOTSTRAP enabled for SubscriptionConfirmation only');
    }
  });
}

module.exports = { app, processMessage };
