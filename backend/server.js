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
const { splitMessage, sleep } = require('./lib/message-splitter');
const { getBotState } = require('./lib/bot-state');

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
const TESS_AGENT_ID = String(process.env.TESS_AGENT_ID || '33200');
const TESS_API_BASE = (process.env.TESS_API_BASE || 'https://api.tess.im').replace(/\/+$/, '');
const TESS_URL = process.env.TESS_API_URL || `${TESS_API_BASE}/agents/${TESS_AGENT_ID}/execute`;
// TESS workspace header removido — causa 403 na API TESS (testado 2026-03-09)

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

// --- Human takeover state (memoria, TTL configuravel) ---
// Coexistencia: quando o staff do salao responde manualmente pelo app, Kapso envia
// 'whatsapp.message.sent' com origin='business_app' (se o evento estiver assinado).
// Marcamos a conversa como human-handled e o bot fica silencioso por HUMAN_HANDLED_TTL_HOURS.
const HUMAN_HANDLED_TTL_MS = (parseInt(process.env.HUMAN_HANDLED_TTL_HOURS || '6', 10)) * 60 * 60 * 1000;
const humanHandledUntil = new Map(); // phone (digits) -> timestamp_ms (vencimento)

function markHumanHandled(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return;
  const until = Date.now() + HUMAN_HANDLED_TTL_MS;
  humanHandledUntil.set(digits, until);
  console.log(`[kapso] ${digits} → HUMAN-HANDLED ate ${new Date(until).toISOString()}`);
}

function isHumanHandled(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return false;
  const until = humanHandledUntil.get(digits);
  if (!until) return false;
  if (Date.now() > until) {
    humanHandledUntil.delete(digits);
    return false;
  }
  return true;
}

// Parser de tags de booking — importado de modulo compartilhado (backend/lib/).
// Single source of truth pra prod (este arquivo) e scripts de teste.
const {
  normalizeJsonQuotes,
  parseInlineArgs,
  stripBookingTags,
  sanitizePrematureConfirm,
  resolveServiceName,
  renderFutureBookings,
} = require('./lib/booking-parser');

// Camada de resiliência Trinks (cache + limiter + retry) — story trinks-resiliencia-429.
const { createTrinksCache } = require('./lib/trinks-cache');
// Monitor de cota Trinks (contador mensal compartilhado) — story trinks-quota-monitor.
const { recordTrinksCall, getTrinksUsage, newlyCrossed } = require('./lib/trinks-usage');

const app = express();
app.use(cors());
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

// Retorna { hour, minute, weekday (0=Dom..6=Sab) } no fuso do salao.
function getTimePartsInSalonTimeZone(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIME_ZONE,
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = t => parts.find(p => p.type === t)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: parseInt(pick('hour'), 10),
    minute: parseInt(pick('minute'), 10),
    weekday: weekdayMap[pick('weekday')] ?? 0,
  };
}

// Politica de horario do salao:
//   Ter-Sex (2-5): 9h-19h
//   Sab (6):       9h-18h
//   Dom (0) e Seg (1): FECHADO
// Retorna { open: bool, hhmm: 'HH:MM', reason: string }
function isSalonOpen(date = new Date()) {
  const { hour, minute, weekday } = getTimePartsInSalonTimeZone(date);
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  let open = false;
  let reason = '';
  if (weekday === 0) reason = 'DOMINGO — salao fechado';
  else if (weekday === 1) reason = 'SEGUNDA — salao fechado';
  else if (weekday === 6) {
    if (hour >= 9 && hour < 18) open = true;
    else reason = hour < 9 ? 'SABADO antes das 9h' : 'SABADO depois das 18h';
  } else {
    // Ter-Sex
    if (hour >= 9 && hour < 19) open = true;
    else reason = hour < 9 ? 'antes das 9h' : 'depois das 19h';
  }
  return { open, hhmm, reason, weekday };
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

function getNextBusinessDays(count) {
  const dates = [];
  let cursor = getTodayIsoInSalonTimeZone();
  while (dates.length < count) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay(); // 0=Dom, 1=Seg
    if (day !== 0 && day !== 1) dates.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dates;
}

const DYNAMIC_CONTEXT_PREFIX = 'CONTEXTO DINAMICO - TRINKS (dados em tempo real):';

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
      `SELECT trinks_id, service_name, professional_name, scheduled_at, status
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

async function saveConversationTurns(phone, turns) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || !turns.length) return;
  for (const t of turns) {
    await db.query(
      `INSERT INTO conversation_history (client_phone, role, content, agent) VALUES ($1, $2, $3, $4)`,
      [digits, t.role, t.content, t.agent || null]
    );
  }
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

function buildPersistedSection(persistedMemory) {
  if (!persistedMemory) return '';
  const { client, history } = persistedMemory;
  const lines = [];

  if (client) {
    if (client.name) lines.push(`Nome: ${client.name}`);
    if (client.last_service) lines.push(`Ultimo servico: ${client.last_service}`);
    if (client.last_visit) lines.push(`Ultima visita: ${new Date(client.last_visit).toLocaleDateString('pt-BR')}`);
    if (client.visit_count) lines.push(`Total de visitas: ${client.visit_count}`);
  }

  let section = '';
  if (lines.length) section += '\nPERFIL DO CLIENTE:\n' + lines.map(l => `- ${l}`).join('\n');
  if (history?.length) {
    section += '\n\nHISTORICO ANTERIOR (sessoes anteriores):\n' +
      history.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n');
  }
  return section;
}

function buildDynamicContext(businessDays, slotsText, professionalsText, history = [], servicesText = '', persistedMemory = null, futureBookings = []) {
  const persistedSection = buildPersistedSection(persistedMemory);
  const futureBookingsSection = renderFutureBookings(futureBookings, formatBookingDateTime); // item 3 Rota C
  const historyText = history.length
    ? '\n\nHISTORICO DA CONVERSA:\n' + history
        .map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`)
        .join('\n')
    : '';
  const salonNow = isSalonOpen();
  const horarioAgora = salonNow.open
    ? `HORARIO_AGORA: ${salonNow.hhmm} (DENTRO do horario — salao ABERTO)`
    : `HORARIO_AGORA: ${salonNow.hhmm} (FORA do horario — ${salonNow.reason}). Agende normalmente mas avise o cliente que o Gabriel confere de manha.`;
  return [
    DYNAMIC_CONTEXT_PREFIX,
    `HOJE: ${formatFullDateLabel(getTodayIsoInSalonTimeZone())}`,
    horarioAgora,
    'HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO',
    `DATAS COM DADOS DISPONIVEIS: ${businessDays.map(formatDateLabel).join(', ')}`,
    '',
    slotsText,
    professionalsText,
    servicesText,
    persistedSection,
    futureBookingsSection,
    historyText,
  ].join('\n');
}

// --- Trinks helpers ---
// Resiliência Trinks (story trinks-resiliencia-429): limiter de concorrência + retry 429 + cache TTL.
// Raiz do 429: cada mensagem dispara ~7 chamadas concorrentes sem cache → rajada estoura o rate-limit.
// Lógica encapsulada em lib/trinks-cache.js (testável); aqui só instanciamos + TTLs configuráveis.
const TRINKS_SERVICES_TTL_MS = (parseInt(process.env.TRINKS_SERVICES_TTL_S || '1200', 10)) * 1000; // 20min
const TRINKS_PROFS_TTL_MS = (parseInt(process.env.TRINKS_PROFS_TTL_S || '1200', 10)) * 1000;       // 20min
const TRINKS_SLOTS_TTL_MS = (parseInt(process.env.TRINKS_SLOTS_TTL_S || '45', 10)) * 1000;          // 45s

// Cota mensal contratada (base 5.000 + adicionais R$60/+5.000, NÃO cumulativos). Configurável.
const TRINKS_MONTHLY_BUDGET = parseInt(process.env.TRINKS_MONTHLY_BUDGET || '5000', 10);

const trinksCache = createTrinksCache({
  baseUrl: TRINKS_API_BASE,
  apiKey: TRINKS_KEY,
  estId: TRINKS_EST_ID,
  sleepImpl: sleep,
  onCall: () => recordTrinksCall(db),   // conta cada chamada Trinks do bot no contador mensal
  maxConcurrency: parseInt(process.env.TRINKS_MAX_CONCURRENCY || '3', 10),
  maxRetries: parseInt(process.env.TRINKS_MAX_RETRIES || '2', 10),
});
// Wrappers finos: preservam a assinatura usada pelos callers existentes do server.js.
const fetchTrinks = (path, opts) => trinksCache.fetchTrinks(path, opts);
const cachedFetchTrinks = (path, ttlMs) => trinksCache.cachedFetchTrinks(path, ttlMs);
const invalidateTrinksCache = (path) => trinksCache.invalidate(path);
const slotsCacheKey = (date) => trinksCache.slotsCacheKey(date);
const trinksCacheMetrics = trinksCache.metrics;

// --- Trinks health ping (Story 1.7) ---
// Cache aplicado em sucesso E falha pra nao martelar Trinks em outage.
// ERA 60s → se o painel /saude fica aberto (polling 10s), eram ~1440 chamadas/dia só de ping.
// Default 10min (configurável TRINKS_PING_TTL_S) pra preservar a cota mensal de 5.000.
const TRINKS_PING_TTL_MS = (parseInt(process.env.TRINKS_PING_TTL_S || '600', 10)) * 1000;
const TRINKS_SLOW_THRESHOLD_MS = 1500;
let trinksPingCache = { payload: null, expiresAt: 0 };

async function pingTrinks() {
  const now = Date.now();
  if (trinksPingCache.payload && now < trinksPingCache.expiresAt) {
    return { ...trinksPingCache.payload, cached: true };
  }
  try {
    const t0 = Date.now();
    await fetchTrinks('/servicos', { retries: 0 }); // health ping: sem retry, reflete 429 transitório honestamente
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

async function getSlots(date) {
  try {
    const json = await cachedFetchTrinks(slotsCacheKey(date), TRINKS_SLOTS_TTL_MS);
    if (!json.data || !Array.isArray(json.data)) return 'HORARIOS: Erro ao consultar. Peca ao cliente o dia desejado.';
    const available = json.data.filter(p => p.horariosVagos?.length > 0);
    if (available.length === 0) return `HORARIOS VAGOS ${formatDateLabel(date)}:\n- Nenhum horario disponivel.`;
    let txt = `HORARIOS VAGOS ${formatDateLabel(date)}:\n`;
    for (const p of available) {
      txt += `- ${p.apelido || p.nome}: ${p.horariosVagos.join(', ')}\n`;
    }
    return txt;
  } catch (err) {
    console.error('Trinks slots error:', err.message);
    return 'HORARIOS: Erro ao consultar. Peca ao cliente o dia desejado.';
  }
}

async function getProfessionals() {
  try {
    const json = await cachedFetchTrinks('/profissionais', TRINKS_PROFS_TTL_MS);
    if (!json.data || !Array.isArray(json.data)) return { text: 'PROFISSIONAIS: Erro ao consultar.', data: [] };
    let txt = 'PROFISSIONAIS ATIVOS:\n';
    for (const p of json.data) {
      txt += `- ${p.apelido || p.nome} (ID ${p.id})\n`;
    }
    return { text: txt, data: json.data };
  } catch (err) {
    console.error('Trinks professionals error:', err.message);
    return { text: 'PROFISSIONAIS: Erro ao consultar.', data: [] };
  }
}

async function getServicesText() {
  try {
    const json = await cachedFetchTrinks('/servicos', TRINKS_SERVICES_TTL_MS);
    const list = Array.isArray(json.data) ? json.data : [];
    if (!list.length) return { text: 'SERVICOS: Erro ao consultar.', data: [] };
    // Agrupa por profissional (campo "profissionalNome" ou similar), senão lista plana
    let txt = 'SERVICOS DISPONIVEIS (use o nome EXATO na tag BOOKING_CONFIRM):\n';
    for (const s of list) {
      const prof = s.profissionalNome || s.profissional || '';
      txt += `- ${s.nome}${prof ? ` [${prof}]` : ''} (ID ${s.id})\n`;
    }
    // Story bot-46589 item 1: retorna data estruturada p/ resolver nome do serviço pelo ID no card de confirmação.
    return { text: txt, data: list };
  } catch (err) {
    console.error('Trinks services text error:', err.message);
    return { text: 'SERVICOS: Erro ao consultar.', data: [] };
  }
}

// Busca servicos de um profissional especifico (retorna id + duracao)
async function getServiceForProfessional(professionalId, serviceName) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove prefixos de ruido comuns na extracao do historico
  const cleanedName = (serviceName || '').replace(/^(o\s+agendamento\s+de\s+|os?\s+servic[oa]s?\s+de\s+|a\s+confirmac[aã]o\s+de\s+)/i, '').trim();
  const target = norm(cleanedName);
  const endpoints = [
    `/profissionais/${professionalId}/servicos`,
    `/servicos?profissionalId=${professionalId}`,
    `/servicos`,
  ];
  for (const path of endpoints) {
    try {
      const json = await fetchTrinks(path);
      const list = Array.isArray(json.data) ? json.data : [];
      console.log(`[Trinks] ${path} → ${list.length} servicos:`, list.map(s => `${s.id}:${s.nome || s.name}`).join(' | '));
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
      console.log(`[Trinks] Match "${serviceName}" → "${found?.nome}" (score ${bestScore})`);
      if (found) return { id: found.id, duracao: found.duracao || found.duracaoEmMinutos || found.duration || 60, valor: found.valor ?? found.preco ?? found.price ?? 0 };
    } catch (err) {
      console.error(`[Trinks] ${path} erro:`, err.message);
    }
  }
  return null;
}

// Busca clienteId (ID global) pelo telefone via GET /clientes?telefone=X.
// Documentacao oficial (trinks.readme.io): POST /agendamentos usa clienteId, nao clienteEstabelecimentoId.
async function getClientId(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  try {
    const json = await fetchTrinks(`/clientes?telefone=${digits}`);
    const item = Array.isArray(json.data) ? json.data[0] : json.data;
    if (item?.id) {
      console.log(`[Trinks] clienteId: ${item.id} (${item.nome})`);
      return item.id;
    }
  } catch (err) {
    console.log(`[Trinks] /clientes?telefone=${digits} → ${err.message}`);
  }
  console.warn(`[Trinks] cliente nao encontrado para telefone ${digits}`);
  return null;
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
  const dayStart = `${date}T00:00:00`;
  const dayEnd   = `${date}T23:59:59`;
  try {
    const json = await fetchTrinks(`/agendamentos?clienteId=${clienteId}&dataInicio=${dayStart}&dataFim=${dayEnd}`);
    const list = Array.isArray(json.data) ? json.data : [];
    console.log(`[Trinks] findClientBooking clienteId:${clienteId} data:${date} → ${list.length} agendamentos`);
    if (!list.length) return null;
    // Se profissionalId fornecido, prioriza o agendamento desse profissional
    if (professionalId) {
      const match = list.find(b => String(b.profissionalId) === String(professionalId));
      if (match) return match;
    }
    return list[0];
  } catch (err) {
    console.error(`[Trinks] findClientBooking erro:`, err.message);
    return null;
  }
}

// Cancela agendamento via PATCH /agendamentos/{id}/status/cancelado
async function cancelBookingInTrinks(agendamentoId, clienteId, motivo) {
  const url = `${TRINKS_API_BASE}/agendamentos/${agendamentoId}/status/cancelado`;
  const payload = {
    quemCancelou: clienteId,
    motivo: motivo || 'Cancelado pelo cliente via WhatsApp',
  };
  console.log(`[Trinks] PATCH ${url} payload:`, JSON.stringify(payload));
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'X-Api-Key': TRINKS_KEY,
      'estabelecimentoId': TRINKS_EST_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text().catch(() => '');
  console.log(`[Trinks] PATCH cancelado → ${res.status}:`, text || '(no body)');
  if (!res.ok) throw new Error(`Trinks ${res.status}: ${text}`);
  return { agendamentoId, cancelado: true };
}

// Reagenda agendamento via PUT /agendamentos/{id}
async function rescheduleBookingInTrinks(agendamentoId, booking, professionalsData) {
  const profId = booking.professionalId
    || matchByName(professionalsData, booking.professional || '', 'apelido', 'nome')?.id;

  const [svcData, clienteId] = await Promise.all([
    profId ? getServiceForProfessional(profId, booking.service) : Promise.resolve(null),
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

  const url = `${TRINKS_API_BASE}/agendamentos/${agendamentoId}`;
  console.log(`[Trinks] PUT ${url} payload:`, JSON.stringify(payload));
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Api-Key': TRINKS_KEY,
      'estabelecimentoId': TRINKS_EST_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text().catch(() => '');
  console.log(`[Trinks] PUT reagendamento → ${res.status}:`, text || '(no body)');
  if (!res.ok) throw new Error(`Trinks ${res.status}: ${text}`);
  return { agendamentoId, reagendado: true };
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

async function createBookingInTrinks(booking, professionalsData) {
  const profId = booking.professionalId
    || matchByName(professionalsData, booking.professional || '', 'apelido', 'nome')?.id;

  // Caminho rápido: se prompt v2 já mandou servicoId numérico, pulamos lookup por nome.
  // Senão, mantemos lookup legado por nome (compat com prompt v1 ou casos sem ID).
  const hasDirectServiceId = Number.isInteger(booking.serviceId);

  const [svcData, clienteId] = await Promise.all([
    hasDirectServiceId
      ? Promise.resolve(null) // serviceId direto — usar valor/duração do payload v2
      : (profId ? getServiceForProfessional(profId, booking.service) : Promise.resolve(null)),
    booking.clientPhone ? getClientId(booking.clientPhone) : Promise.resolve(null),
  ]);

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

  const url = `${TRINKS_API_BASE}/agendamentos`;
  console.log(`[Trinks] POST ${url} payload:`, JSON.stringify(payload));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Api-Key': TRINKS_KEY,
      'estabelecimentoId': TRINKS_EST_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  console.log(`[Trinks] POST /agendamentos → ${res.status}:`, JSON.stringify(data));
  if (!res.ok) throw new Error(`Trinks ${res.status}: ${JSON.stringify(data)}`);
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
  const headers = {
    'Authorization': `Bearer ${TESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(TESS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
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

function splitLongChunk(chunk, maxLen) {
  if (chunk.length <= maxLen) return [chunk];
  const sentences = chunk.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [chunk];
  const parts = [];
  let current = '';
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + ' ' + sentence).length <= maxLen) {
      current += ' ' + sentence;
    } else {
      parts.push(current);
      current = sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function toWhatsappBlocks(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const roughBlocks = paragraphs.length ? paragraphs : [text.trim()];
  const expanded = [];
  for (const block of roughBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const hasList = lines.some(l => l.startsWith('- '));
    if (hasList || block.length <= 340) {
      expanded.push(block);
      continue;
    }
    expanded.push(...splitLongChunk(block, 300));
  }

  const compact = [];
  for (const block of expanded) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const prev = compact[compact.length - 1];
    if (prev && !prev.includes('\n') && !trimmed.includes('\n') && (prev.length + trimmed.length + 1 <= 300)) {
      compact[compact.length - 1] = `${prev} ${trimmed}`;
    } else {
      compact.push(trimmed);
    }
  }

  return compact.slice(0, 6);
}

function formatAssistantOutput(rawText, isFirstTurn) {
  let text = normalizeFormatting(rawText);
  if (!isFirstTurn) text = removeRepeatedIntro(text);
  if (!text) text = 'Perfeito. Me diz o que voce prefere que eu te ajudo agora.';
  const responses = toWhatsappBlocks(text);
  return {
    response: responses[0] || text,
    responses: responses.length ? responses : [text],
  };
}


// --- Core message orchestration ---
async function processMessage(sessionId, messageText, contactName, incomingHistoryRaw, phone = null) {
  const startTime = Date.now();
  const state = sessionState.get(sessionId) || { turn: 0, rootId: null, history: [], persistedMemory: null };

  // Cold start: load persisted memory from DB (phone sessions) or client-side history fallback (webchat)
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
  console.log(`[${sessionId}] ${contactName}: "${messageText}"`);

  // 1. Fetch Trinks data in parallel (next 5 business days) + agendamentos futuros do cliente (DB local, item 3 Rota C)
  const businessDays = getNextBusinessDays(5);
  const [slotsResults, profsResult, svcTextResult, futureBookingsResult] = await Promise.allSettled([
    Promise.all(businessDays.map(date => getSlots(date))),
    getProfessionals(),
    getServicesText(),
    phone ? loadClientFutureBookings(phone) : Promise.resolve([]),
  ]);

  const profsPayload = profsResult.status === 'fulfilled'
    ? profsResult.value
    : { text: 'PROFISSIONAIS: Erro ao consultar.', data: [] };
  const slotsAll = slotsResults.status === 'fulfilled'
    ? slotsResults.value.join('\n')
    : 'HORARIOS: Erro ao consultar. Peca ao cliente o dia desejado.';
  const svcPayload = svcTextResult.status === 'fulfilled'
    ? svcTextResult.value
    : { text: 'SERVICOS: Erro ao consultar.', data: [] };
  const svcText = svcPayload.text;
  const futureBookings = futureBookingsResult.status === 'fulfilled' ? futureBookingsResult.value : [];

  // 2. Call TESS
  // O agente TESS ignora role:system — contexto dinamico injetado no user message + root_id para thread.
  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry?.role !== 'user' || lastEntry.content !== messageText) {
    state.history.push({ role: 'user', content: messageText });
  }
  const dynamicContext = buildDynamicContext(businessDays, slotsAll, profsPayload.text, state.history, svcText, state.persistedMemory, futureBookings);
  const userMessageWithContext = `${dynamicContext}\n\nMENSAGEM DO CLIENTE: ${messageText}`;
  const tessRaw = await callTESS([
    { role: 'user', content: userMessageWithContext },
  ], state.rootId);

  const tessText = extractTESSResponse(tessRaw);
  const rootId = extractTESSRootId(tessRaw);
  if (rootId) state.rootId = rootId;
  if (!tessText) {
    console.error('[TESS] Empty response:', JSON.stringify(tessRaw).slice(0, 300));
    return {
      response: 'Ola! Estou com uma dificuldade tecnica. Nosso atendimento humano entrara em contato em breve!',
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Strip booking tags from text (TESS emite tags que nao devem aparecer ao cliente)
  const { clean: cleanText, bookingConfirm, bookingCancel, bookingReschedule, handoffHuman } = stripBookingTags(tessText);
  // 2-phase: se ha tag de booking, sanitizar "Agendado!/Confirmado!/Pronto!" antes de exibir.
  // Razao: bot nao deve afirmar que agendou antes da Trinks responder (rota infeliz mente pro cliente).
  // Mensagem final de sucesso/falha eh construida pelo backend apos chamada a Trinks (bloco 4 abaixo).
  const hasBookingTag = bookingConfirm || bookingCancel || bookingReschedule;
  const displayText = hasBookingTag ? sanitizePrematureConfirm(cleanText) : cleanText;
  const formatted = formatAssistantOutput(displayText, state.turn === 0);
  state.history.push({ role: 'assistant', content: cleanText });
  state.turn += 1;
  state.lastAccess = Date.now();
  // Clear persisted memory after first turn — session history is now authoritative
  if (state.turn === 1) state.persistedMemory = null;
  sessionState.set(sessionId, state);
  evictOldSessions();

  // Persist conversation turns to PostgreSQL (fire-and-forget, non-blocking)
  if (phone) {
    saveConversationTurns(phone, [
      { role: 'user', content: messageText },
      { role: 'assistant', content: cleanText },
    ]).catch(err => console.error('[DB] Save turns error:', err.message));
  }

  // 4. Executar acao no Trinks de acordo com tag emitida pelo TESS
  let bookingResult = null;
  // Prioriza phone do canal (kapso/meta sabe quem mandou) — historico so quando webchat sem identificacao
  const clientPhone = phone || extractPhoneFromHistory(state.history);

  // Mensagens finais 2-phase (apos chamada a Trinks). Acumuladas em finalMessages,
  // enviadas como blocos extras apos o reply principal sanitizado.
  const finalMessages = [];

  // 4a. Criar agendamento — suporta v2 (service_id direto) e v1 legacy (service_name)
  if (bookingConfirm) {
    const profObj = bookingConfirm.professional_id
      ? profsPayload.data.find(p => p.id === bookingConfirm.professional_id)
      : null;
    const bookingData = {
      service: bookingConfirm.service_name,            // legacy
      serviceId: bookingConfirm.service_id,            // v2
      valor: bookingConfirm.valor,                     // v2 (preço já decidido pelo TESS)
      professional: profObj?.apelido || null,
      professionalId: bookingConfirm.professional_id,
      date: bookingConfirm.date_time?.split('T')[0],
      time: bookingConfirm.date_time?.split('T')[1]?.slice(0, 5),
      durationMinutes: bookingConfirm.duration_minutes,
      clientPhone,
    };
    console.log(`[${sessionId}] Booking from tag:`, JSON.stringify(bookingData));
    try {
      bookingResult = await createBookingInTrinks(bookingData, profsPayload.data);
      console.log(`[${sessionId}] Booking created in Trinks:`, JSON.stringify(bookingResult));
      if (bookingData.date) invalidateTrinksCache(slotsCacheKey(bookingData.date)); // AC3: slot tomado não pode reaparecer
      // Story bot-46589 item 1: resolve o nome do serviço (legacy traz service_name; v2 só service_id → resolve pelo ID).
      const servicoNome = bookingData.service || resolveServiceName(svcPayload.data, bookingData.serviceId);
      if (phone && (servicoNome || bookingData.serviceId)) {
        // Persiste o nome real quando disponível (evita gravar "id:123" em last_service).
        updateClientAfterBooking(phone, servicoNome || `id:${bookingData.serviceId}`).catch(() => {});
      }
      // 2-phase sucesso: mensagem final construida pelo backend, NAO pelo TESS.
      const valorFmt = (bookingData.valor ?? bookingResult?.valor ?? 0).toFixed(2).replace('.', ',');
      const dataFmt = bookingData.date && bookingData.time
        ? `${bookingData.date.split('-').reverse().join('/')} às ${bookingData.time}`
        : 'no horario combinado';
      const profNome = profObj?.apelido || profObj?.nome || 'a equipe';
      // item 1: inclui a linha do serviço só quando resolvido (degrada graciosamente — AC4: nunca imprime "id:undefined").
      const servicoLinha = servicoNome ? `💅 ${servicoNome}\n` : '';
      finalMessages.push(
        `Prontinho! Te esperamos no Studio Tirra 😊\n\n` +
        `📅 ${dataFmt}\n` +
        servicoLinha +
        `💇 com ${profNome}\n` +
        `💰 R$ ${valorFmt}\n\n` +
        `📍 R. Espírito Santo, 385 - Santo Antônio, São Caetano do Sul\n` +
        `🅿️ Estacionamento: subir rampa lateral\n\n` +
        `Qualquer coisa é só chamar! ✌🏻`
      );
    } catch (err) {
      console.error(`[${sessionId}] Booking creation FAILED:`, err.message);
      // 2-phase falha: mensagem honesta de erro + sugestao
      finalMessages.push(
        `Opa, tive um problema técnico ao confirmar esse horário 😕\n\n` +
        `Deixa eu tentar outro horário próximo pra você. Me fala se prefere outro dia ou outro profissional?`
      );
    }
  }

  // 4b. Cancelar agendamento
  if (bookingCancel) {
    console.log(`[${sessionId}] Booking cancel from tag:`, JSON.stringify(bookingCancel));
    try {
      const clienteId = clientPhone ? await getClientId(clientPhone) : null;
      if (!clienteId) throw new Error('clienteId nao encontrado para cancelamento');

      const agendamentoId = bookingCancel.agendamento_id
        || (bookingCancel.date ? (await findClientBooking(clienteId, bookingCancel.date, bookingCancel.professional_id))?.id : null);

      if (!agendamentoId) throw new Error(`Agendamento nao encontrado para data ${bookingCancel.date}`);

      bookingResult = await cancelBookingInTrinks(agendamentoId, clienteId, bookingCancel.motivo);
      console.log(`[${sessionId}] Booking cancelled in Trinks: agendamentoId ${agendamentoId}`);
      if (bookingCancel.date) invalidateTrinksCache(slotsCacheKey(bookingCancel.date)); // AC3: slot liberado volta a aparecer
      finalMessages.push(`Pronto, cancelei seu horário! Qualquer coisa, é só chamar pra reagendar. 😊`);
    } catch (err) {
      console.error(`[${sessionId}] Booking cancel FAILED:`, err.message);
      finalMessages.push(
        `Não consegui localizar/cancelar seu horário automaticamente 😕\n` +
        `Vou pedir pro Gabriel resolver com você. Um momento!`
      );
    }
  }

  // 4c. Reagendar agendamento
  if (bookingReschedule) {
    console.log(`[${sessionId}] Booking reschedule from tag:`, JSON.stringify(bookingReschedule));
    try {
      const clienteId = clientPhone ? await getClientId(clientPhone) : null;
      if (!clienteId) throw new Error('clienteId nao encontrado para reagendamento');

      const agendamentoId = bookingReschedule.agendamento_id
        || (bookingReschedule.old_date ? (await findClientBooking(clienteId, bookingReschedule.old_date, bookingReschedule.professional_id))?.id : null);

      if (!agendamentoId) throw new Error(`Agendamento original nao encontrado para data ${bookingReschedule.old_date}`);

      const newBooking = {
        service: bookingReschedule.service_name,
        serviceId: bookingReschedule.service_id,
        professionalId: bookingReschedule.professional_id,
        date: bookingReschedule.date_time?.split('T')[0],
        time: bookingReschedule.date_time?.split('T')[1]?.slice(0, 5),
        durationMinutes: bookingReschedule.duration_minutes,
        clientPhone,
      };

      bookingResult = await rescheduleBookingInTrinks(agendamentoId, newBooking, profsPayload.data);
      console.log(`[${sessionId}] Booking rescheduled in Trinks: agendamentoId ${agendamentoId}`);
      // AC3: invalida data antiga (libera slot) e nova (ocupa slot)
      if (bookingReschedule.old_date) invalidateTrinksCache(slotsCacheKey(bookingReschedule.old_date));
      if (newBooking.date) invalidateTrinksCache(slotsCacheKey(newBooking.date));
      const dataFmt = newBooking.date && newBooking.time
        ? `${newBooking.date.split('-').reverse().join('/')} às ${newBooking.time}`
        : 'no horario combinado';
      finalMessages.push(`Pronto, reagendei pra ${dataFmt}! Te esperamos. 😊`);
    } catch (err) {
      console.error(`[${sessionId}] Booking reschedule FAILED:`, err.message);
      finalMessages.push(
        `Tive um problema pra reagendar 😕 Vou pedir pro Gabriel resolver com você direto. Um momento!`
      );
    }
  }

  // 4d. Handoff humano (TESS sinalizou que precisa de pessoa)
  // OBS: notificacao ao Tiago via Kapso ainda sera implementada (Supervisor sincrono).
  if (handoffHuman) {
    console.log(`[${sessionId}] HANDOFF_HUMAN motivo:${handoffHuman.motivo}`);
    // Marcar conversa como human-handled para silenciar bot ate Tiago responder.
    if (clientPhone) markHumanHandled(clientPhone);
  }

  console.log(`[${sessionId}] Response (${Date.now() - startTime}ms): "${formatted.response.slice(0, 80)}..."`);
  // Anexa mensagens finais (sucesso/falha 2-phase) como blocos extras apos o reply principal.
  const allBlocks = [...formatted.responses, ...finalMessages];
  const result = {
    response: allBlocks[0],
    responses: allBlocks,
    timestamp: new Date().toISOString(),
  };
  if (bookingResult) result.booking = bookingResult;
  if (handoffHuman) result.handoff = handoffHuman;
  // Sinaliza booking criado fora-de-horario para o handler notificar o Tiago.
  if (bookingConfirm && bookingResult && !isSalonOpen().open) {
    const profObj = bookingConfirm.professional_id
      ? profsPayload.data.find(p => p.id === bookingConfirm.professional_id)
      : null;
    result.afterHoursBooking = {
      booking: {
        service: bookingConfirm.service_name,
        serviceId: bookingConfirm.service_id,
        valor: bookingConfirm.valor,
        professional: profObj?.apelido || null,
        professionalId: bookingConfirm.professional_id,
        date: bookingConfirm.date_time?.split('T')[0],
        time: bookingConfirm.date_time?.split('T')[1]?.slice(0, 5),
      },
      bookingResult,
      clientPhone,
      salonState: isSalonOpen(),
    };
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

// --- Webchat endpoint (demo / testes) ---
app.post('/webhook/demo-chat', withTimeout(async (req, res) => {
  const { message, session_id, contact_name = 'Visitante', history: incomingHistoryRaw } = req.body;
  const sessionId = String(session_id || 'anonymous');
  if (!message || !message.trim()) {
    return res.status(400).json({ response: 'Mensagem vazia', timestamp: new Date().toISOString() });
  }
  const result = await processMessage(sessionId, message.trim(), contact_name, incomingHistoryRaw, null);
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
  const text =
    `🔔 Bot pediu sua atencao\n\n` +
    `Motivo: ${motivo || 'nao especificado'}\n` +
    `Cliente: ${clientName || 'sem nome'} (${clientPhone || '?'})\n` +
    `Ultima msg: "${(lastClientMsg || '').slice(0, 200)}"\n\n` +
    `Abre o WhatsApp do salao pra continuar com o cliente. Bot esta silencioso pelas proximas horas.`;
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
  if (!res.ok) console.error(`[kapso] send → ${res.status}: ${body.slice(0, 300)}`);
  else console.log(`[kapso] send → ${res.status} para ${to}`);
}

// Envia mensagem para a Kapso, com split tag-aware se o texto conter <break>.
// Comportamento:
//   - Texto sem <break>: send unico (zero overhead, identico ao comportamento anterior)
//   - Texto com <break>: split em bolhas, envia em sequencia com BUBBLE_DELAY_MS entre
//   - Tags inline ([BOOKING_*], [HANDOFF_*]) sempre integras (garantia do splitter)
async function sendKapsoMessage(to, text, phoneNumberId) {
  if (!KAPSO_API_KEY) {
    console.error('[kapso] KAPSO_API_KEY ausente — nao envio mensagem');
    return;
  }
  if (!phoneNumberId) {
    console.error('[kapso] phone_number_id ausente — nao envio mensagem');
    return;
  }
  const bubbles = splitMessage(text);
  if (bubbles.length === 0) {
    console.warn('[kapso] sendKapsoMessage chamado com texto vazio — skip');
    return;
  }
  for (let i = 0; i < bubbles.length; i++) {
    if (i > 0) await sleep(BUBBLE_DELAY_MS);
    await sendKapsoSingle(to, bubbles[i], phoneNumberId);
  }
}

function validateKapsoSignature(req) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[kapso] KAPSO_WEBHOOK_SECRET not set — skipping HMAC validation (dev mode)');
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
    console.warn(`[kapso] HMAC length mismatch — sig=${signature.length}ch expected=${expected.length}ch. header raw="${(req.headers['x-webhook-signature'] || '').slice(0,32)}…"`);
    return false;
  }
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    if (!ok) console.warn(`[kapso] HMAC mismatch — sig=${signature.slice(0,16)}… expected=${expected.slice(0,16)}…`);
    return ok;
  } catch (e) {
    console.warn(`[kapso] HMAC error: ${e.message}`);
    return false;
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
      markHumanHandled(targetPhone);
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
    .map(e => (e?.message?.kapso?.content || e?.message?.text?.body || '').trim())
    .filter(Boolean)
    .join('\n');

  const sessionId = firstConv?.phone_number || firstMsg?.from || 'unknown';
  // contact_name pode vir em conversation.contact_name (novo) ou conversation.kapso.contact_name (legado da doc)
  const contactName = firstConv?.contact_name || firstConv?.kapso?.contact_name || 'Cliente';
  const sessionPhone = String(sessionId).replace(/\D/g, '');
  // phone_number_id da conexao (numero da recepcao) — precisamos pra chamar a API do Kapso
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
    ]).catch(err => console.error('[passive-log] erro:', err.message));
  }

  // 4. Bot state via DB (Story 1.2-DATA): toggles + whitelist com cache 5s.
  // Fallback ao BOT_ALLOWED_PHONES/BOT_ACCEPT_ALL env se DB indisponível ou whitelist vazia.
  const botState = await getBotState();

  // 4a. Kill switch global (apenas se DB disponível)
  if (botState.toggles && botState.toggles.global === false) {
    console.log(`[kapso][${sessionId}] BOT GLOBAL DESLIGADO via DB — silencioso`);
    return res.json({ ok: true });
  }

  // 4b. Whitelist por número
  if (!BOT_ACCEPT_ALL) {
    if (botState.whitelist && botState.whitelist.size > 0) {
      // DB autoritativo
      const mode = botState.whitelist.get(sessionPhone);
      if (mode === 'block' || mode === 'human_only') {
        console.log(`[kapso][${sessionId}] phone ${sessionPhone} mode=${mode} via DB — bot inativo`);
        return res.json({ ok: true });
      }
      if (mode !== 'allow') {
        console.log(`[kapso][${sessionId}] phone ${sessionPhone} ausente da whitelist DB — bot inativo`);
        return res.json({ ok: true });
      }
    } else {
      // Fallback legacy: DB indisponível ou whitelist vazia → env BOT_ALLOWED_PHONES
      if (BOT_ALLOWED_PHONES.length === 0) {
        console.log(`[kapso][${sessionId}] WHITELIST VAZIA (DB+env) — bot silencioso`);
        return res.json({ ok: true });
      }
      if (!BOT_ALLOWED_PHONES.includes(sessionPhone)) {
        console.log(`[kapso][${sessionId}] telefone fora do whitelist env (fallback) — bot inativo`);
        return res.json({ ok: true });
      }
    }
  }

  // 4b. Human takeover: se a conversa foi marcada como human-handled, bot fica calado ate o TTL.
  if (isHumanHandled(sessionPhone)) {
    console.log(`[kapso][${sessionId}] conversa human-handled — bot silencioso (TTL ${HUMAN_HANDLED_TTL_MS / 3600000}h)`);
    return res.json({ ok: true });
  }

  console.log(`[kapso][${sessionId}] message recebida: "${messageText.slice(0, 80)}" pnid=${phoneNumberId}`);

  // 5. Webhook ack imediato — Kapso nao le o body como mensagem.
  // O envio acontece via chamada separada a API do Kapso depois do TESS.
  res.json({ ok: true });

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
        return;
      }
    }

    const result = await processMessage(sessionId, messageText, contactName, null, sessionId);
    const blocks = result.responses?.length ? result.responses : [result.response];
    for (const block of blocks) {
      if (block && block.trim()) await sendKapsoMessage(sessionId, block, phoneNumberId);
    }
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
  }
}, 28000));

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
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    // Ignora status updates (sent/delivered/read) — esses payloads nao tem value.messages
    if (!msg) return;

    // Ignora tipos nao-texto (audio, imagem, sticker) por enquanto
    if (msg.type !== 'text') {
      console.log(`[meta] mensagem tipo "${msg.type}" ignorada`);
      return;
    }

    // Dedupe — a Meta reenvia o webhook se nao receber 200 a tempo
    if (processedMetaMessages.has(msg.id)) {
      console.log(`[meta] mensagem ${msg.id} ja processada — ignorada`);
      return;
    }
    markMetaMessageProcessed(msg.id);

    const from = msg.from; // wa_id, ex: 5511999999999
    const messageText = (msg.text?.body || '').trim();
    const contactName = value?.contacts?.[0]?.profile?.name || 'Cliente';

    console.log(`[meta][${from}] message recebida: "${messageText.slice(0, 80)}"`);
    if (!messageText) return;

    const result = await processMessage(from, messageText, contactName, null, from);

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

// Inicia o scheduler do supervisor (cron interno, checa 7h ter-sab fuso salao)
supervisor.startScheduler({
  sendKapsoMessage,
  getKapsoPhoneNumberId: () => lastKnownKapsoPhoneNumberId,
});

// --- Monitor de cota Trinks (story quota-monitor) ---
// Alerta no WhatsApp ao cruzar thresholds da cota mensal, pra decidir comprar +5.000 (R$60) ou esperar o mês virar.
const TRINKS_ALERT_PHONES = (process.env.TRINKS_ALERT_PHONES || '')
  .split(',').map(s => s.trim().replace(/\D/g, '')).filter(Boolean);
const TRINKS_ALERT_THRESHOLDS = [0.8, 0.9, 1.0];
const TRINKS_QUOTA_CHECK_MS = (parseInt(process.env.TRINKS_QUOTA_CHECK_MIN || '10', 10)) * 60 * 1000;
let _quotaAlertState = { month: null, alerted: new Set() };

async function checkTrinksQuota() {
  const usage = await getTrinksUsage(db, TRINKS_MONTHLY_BUDGET);
  if (_quotaAlertState.month !== usage.month) _quotaAlertState = { month: usage.month, alerted: new Set() };
  const toAlert = newlyCrossed(usage.pct, TRINKS_ALERT_THRESHOLDS, _quotaAlertState.alerted);
  if (!toAlert.length) return;
  toAlert.forEach(t => _quotaAlertState.alerted.add(t));
  const pctLabel = Math.round(usage.pct * 100);
  const atLimit = Math.max(...toAlert) >= 1;
  const msg = `⚠️ Cota Trinks: ${usage.used}/${usage.budget} (${pctLabel}%) em ${usage.month}. Restam ${usage.remaining}. `
    + (atLimit
      ? 'LIMITE ATINGIDO — a API vai bloquear até virar o mês ou contratar +5.000 (R$60).'
      : 'Avalie contratar +5.000 (R$60) agora ou segurar até o reset mensal.');
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
setInterval(() => { checkTrinksQuota().catch(e => console.error('[trinks-quota] check erro:', e.message)); }, TRINKS_QUOTA_CHECK_MS);

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
  // Cota mensal Trinks (story quota-monitor) — leitura do contador compartilhado
  const trinks_usage = await getTrinksUsage(db, TRINKS_MONTHLY_BUDGET);

  res.json({
    status: 'ok',
    service: 'studio-tirra-webchat',
    uptime: process.uptime(),
    tess: {
      agent_id: TESS_AGENT_ID,
      url: TESS_URL,
    },
    postgres: {
      pool: db.getPoolStats(),
      uptime_seconds: process.uptime(),
      last_ok_query_at: globalLastOkAt,
    },
    trinks_ping,
    trinks_cache: { ...trinksCacheMetrics, cached_keys: trinksCache._state.cachedKeys, concurrency_active: trinksCache._state.active }, // story trinks-resiliencia-429
    trinks_usage, // story quota-monitor: { month, used, budget, remaining, pct }
    bot: {
      accept_all: BOT_ACCEPT_ALL,
      whitelist_count: BOT_ALLOWED_PHONES.length,
      mode: BOT_ACCEPT_ALL ? 'OPEN' : (BOT_ALLOWED_PHONES.length === 0 ? 'SILENT' : 'WHITELIST'),
      whitelist_source: 'see /admin/api/whitelist (Story 1.2-DATA cutover in progress)',
      human_handled: {
        active_count: humanHandledUntil.size,
        ttl_hours: HUMAN_HANDLED_TTL_MS / 3600000,
      },
    },
    meta: {
      configured: Boolean(META_ACCESS_TOKEN && META_PHONE_NUMBER_ID),
      phone_number_id: META_PHONE_NUMBER_ID ? 'set' : 'PENDENTE',
      verify_token: META_VERIFY_TOKEN ? 'set' : 'PENDENTE',
      app_secret: META_APP_SECRET ? 'set' : 'PENDENTE',
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

// --- Start ---
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`\n🚀 Studio Tirra Webchat Backend`);
  console.log(`   POST http://localhost:${port}/webhook/demo-chat`);
  console.log(`   POST http://localhost:${port}/webhook/kapso`);
  console.log(`   GET/POST http://localhost:${port}/webhook/meta`);
  console.log(`   GET  http://localhost:${port}/health\n`);
  console.log(`   TESS agent: ${TESS_AGENT_ID}`);
  const botMode = BOT_ACCEPT_ALL ? 'OPEN (responde todos)' : (BOT_ALLOWED_PHONES.length === 0 ? 'SILENT (whitelist vazia)' : `WHITELIST (${BOT_ALLOWED_PHONES.length} telefone(s))`);
  console.log(`   Bot mode: ${botMode}`);
  if (!TESS_TOKEN) console.warn('⚠️  TESS_API_TOKEN not set!');
  if (!TRINKS_KEY) console.warn('⚠️  TRINKS_API_KEY not set!');
});
