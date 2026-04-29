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
const TRINKS_KEY = process.env.TRINKS_API_KEY;
const TRINKS_API_BASE = process.env.TRINKS_API_BASE || 'https://api.trinks.com/v1';
const TRINKS_EST_ID = process.env.TRINKS_ESTABELECIMENTO_ID || '243868';

const app = express();
app.use(cors());
app.use(express.json());
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

async function saveConversationTurns(phone, turns) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || !turns.length) return;
  for (const t of turns) {
    await db.query(
      `INSERT INTO conversation_history (client_phone, role, content) VALUES ($1, $2, $3)`,
      [digits, t.role, t.content]
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

function buildDynamicContext(businessDays, slotsText, professionalsText, history = [], servicesText = '', persistedMemory = null) {
  const persistedSection = buildPersistedSection(persistedMemory);
  const historyText = history.length
    ? '\n\nHISTORICO DA CONVERSA:\n' + history
        .map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`)
        .join('\n')
    : '';
  return [
    DYNAMIC_CONTEXT_PREFIX,
    `HOJE: ${formatFullDateLabel(getTodayIsoInSalonTimeZone())}`,
    'HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO',
    `DATAS COM DADOS DISPONIVEIS: ${businessDays.map(formatDateLabel).join(', ')}`,
    '',
    slotsText,
    professionalsText,
    servicesText,
    persistedSection,
    historyText,
  ].join('\n');
}

// --- Trinks helpers ---
async function fetchTrinks(path) {
  const url = `${TRINKS_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-Api-Key': TRINKS_KEY,
      'estabelecimentoId': TRINKS_EST_ID,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Trinks ${res.status}: ${url}`);
  return res.json();
}

async function getSlots(date) {
  try {
    const json = await fetchTrinks(`/agendamentos/profissionais/${date}`);
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
    const json = await fetchTrinks('/profissionais');
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
    const json = await fetchTrinks('/servicos');
    const list = Array.isArray(json.data) ? json.data : [];
    if (!list.length) return 'SERVICOS: Erro ao consultar.';
    // Agrupa por profissional (campo "profissionalNome" ou similar), senão lista plana
    let txt = 'SERVICOS DISPONIVEIS (use o nome EXATO na tag BOOKING_CONFIRM):\n';
    for (const s of list) {
      const prof = s.profissionalNome || s.profissional || '';
      txt += `- ${s.nome}${prof ? ` [${prof}]` : ''} (ID ${s.id})\n`;
    }
    return txt;
  } catch (err) {
    console.error('Trinks services text error:', err.message);
    return 'SERVICOS: Erro ao consultar.';
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
// Tags suportadas: [BOOKING_REQUEST], [BOOKING_CONFIRM], [BOOKING_CANCEL], [BOOKING_RESCHEDULE]
function stripBookingTags(tessText) {
  let clean = tessText;
  let bookingConfirm = null;
  let bookingCancel = null;
  let bookingReschedule = null;

  const confMatch = clean.match(/\[BOOKING_CONFIRM\]\s*\n?({[\s\S]*?})/i);
  if (confMatch) {
    try { bookingConfirm = JSON.parse(confMatch[1]); } catch {}
    clean = clean.replace(confMatch[0], '').trim();
  }

  const cancelMatch = clean.match(/\[BOOKING_CANCEL\]\s*\n?({[\s\S]*?})/i);
  if (cancelMatch) {
    try { bookingCancel = JSON.parse(cancelMatch[1]); } catch {}
    clean = clean.replace(cancelMatch[0], '').trim();
  }

  const reschedMatch = clean.match(/\[BOOKING_RESCHEDULE\]\s*\n?({[\s\S]*?})/i);
  if (reschedMatch) {
    try { bookingReschedule = JSON.parse(reschedMatch[1]); } catch {}
    clean = clean.replace(reschedMatch[0], '').trim();
  }

  clean = clean.replace(/\[BOOKING_REQUEST\]\s*\n?{[\s\S]*?}/gi, '').trim();

  return { clean, bookingConfirm, bookingCancel, bookingReschedule };
}

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

  // Busca em paralelo: servico do profissional + clienteId (ID global) pelo telefone
  const [svcData, clienteId] = await Promise.all([
    profId ? getServiceForProfessional(profId, booking.service) : Promise.resolve(null),
    booking.clientPhone ? getClientId(booking.clientPhone) : Promise.resolve(null),
  ]);

  const duracao = svcData?.duracao || booking.durationMinutes || 0;

  // POST /agendamentos — campos conforme documentacao oficial trinks.readme.io:
  // clienteId (int32), servicoId (int32), dataHoraInicio (date-time), duracaoEmMinutos (int32), valor (double)
  const payload = {
    dataHoraInicio: `${booking.date}T${booking.time}:00`,
    profissionalId: profId || undefined,
    duracaoEmMinutos: duracao,
    clienteId: clienteId || undefined,
    servicoId: svcData?.id || undefined,
    valor: svcData?.valor ?? 0,
  };

  console.log(`[Trinks] Resolved — profId:${profId} svcId:${svcData?.id} clienteId:${clienteId} duracao:${duracao} valor:${svcData?.valor}`);

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

  // 1. Fetch Trinks data in parallel (next 5 business days)
  const businessDays = getNextBusinessDays(5);
  const [slotsResults, profsResult, svcTextResult] = await Promise.allSettled([
    Promise.all(businessDays.map(date => getSlots(date))),
    getProfessionals(),
    getServicesText(),
  ]);

  const profsPayload = profsResult.status === 'fulfilled'
    ? profsResult.value
    : { text: 'PROFISSIONAIS: Erro ao consultar.', data: [] };
  const slotsAll = slotsResults.status === 'fulfilled'
    ? slotsResults.value.join('\n')
    : 'HORARIOS: Erro ao consultar. Peca ao cliente o dia desejado.';
  const svcText = svcTextResult.status === 'fulfilled'
    ? svcTextResult.value
    : 'SERVICOS: Erro ao consultar.';

  // 2. Call TESS
  // O agente TESS ignora role:system — contexto dinamico injetado no user message + root_id para thread.
  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry?.role !== 'user' || lastEntry.content !== messageText) {
    state.history.push({ role: 'user', content: messageText });
  }
  const dynamicContext = buildDynamicContext(businessDays, slotsAll, profsPayload.text, state.history, svcText, state.persistedMemory);
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
  const { clean: cleanText, bookingConfirm, bookingCancel, bookingReschedule } = stripBookingTags(tessText);
  const formatted = formatAssistantOutput(cleanText, state.turn === 0);
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
  const clientPhone = extractPhoneFromHistory(state.history);

  // 4a. Criar agendamento (apenas quando TESS emite [BOOKING_CONFIRM] explicitamente)
  if (bookingConfirm) {
    const bookingData = {
      service: bookingConfirm.service_name,
      professional: bookingConfirm.professional_id
        ? profsPayload.data.find(p => p.id === bookingConfirm.professional_id)?.apelido || null
        : null,
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
      if (phone && bookingData.service) {
        updateClientAfterBooking(phone, bookingData.service).catch(() => {});
      }
    } catch (err) {
      console.error(`[${sessionId}] Booking creation FAILED:`, err.message);
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
    } catch (err) {
      console.error(`[${sessionId}] Booking cancel FAILED:`, err.message);
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
        professionalId: bookingReschedule.professional_id,
        date: bookingReschedule.date_time?.split('T')[0],
        time: bookingReschedule.date_time?.split('T')[1]?.slice(0, 5),
        durationMinutes: bookingReschedule.duration_minutes,
        clientPhone,
      };

      bookingResult = await rescheduleBookingInTrinks(agendamentoId, newBooking, profsPayload.data);
      console.log(`[${sessionId}] Booking rescheduled in Trinks: agendamentoId ${agendamentoId}`);
    } catch (err) {
      console.error(`[${sessionId}] Booking reschedule FAILED:`, err.message);
    }
  }

  console.log(`[${sessionId}] Response (${Date.now() - startTime}ms): "${formatted.response.slice(0, 80)}..."`);
  const result = { response: formatted.response, responses: formatted.responses, timestamp: new Date().toISOString() };
  if (bookingResult) result.booking = bookingResult;
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
function validateKapsoSignature(req) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[kapso] KAPSO_WEBHOOK_SECRET not set — skipping HMAC validation (dev mode)');
    return true;
  }
  const signature = req.headers['x-webhook-signature'] || req.headers['x-kapso-signature'] || '';
  const rawBody = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post('/webhook/kapso', withTimeout(async (req, res) => {
  const { message, conversation } = req.body;

  // Ignorar mensagens do Business App (Tiago/Gabriel respondeu manualmente)
  if (message?.kapso?.origin === 'business_app' || message?.kapso?.origin === 'history_sync') {
    return res.json({ response: '' });
  }

  if (!validateKapsoSignature(req)) {
    console.warn('[kapso] Invalid HMAC signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const messageText = (message?.kapso?.content || message?.text?.body || '').trim();
  const sessionId = conversation?.phone_number || message?.from || 'unknown';
  const contactName = conversation?.kapso?.contact_name || 'Cliente';

  console.log(`[kapso][${sessionId}] message recebida: "${messageText.slice(0, 80)}"`);

  if (!messageText) return res.json({ response: '' });

  const result = await processMessage(sessionId, messageText, contactName, null, sessionId);
  return res.json(result);
}, 28000));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'studio-tirra-webchat',
    uptime: process.uptime(),
    tess: {
      agent_id: TESS_AGENT_ID,
      url: TESS_URL,
    },
  });
});

// --- Start ---
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`\n🚀 Studio Tirra Webchat Backend`);
  console.log(`   POST http://localhost:${port}/webhook/demo-chat`);
  console.log(`   GET  http://localhost:${port}/health\n`);
  console.log(`   TESS agent: ${TESS_AGENT_ID}`);
  if (!TESS_TOKEN) console.warn('⚠️  TESS_API_TOKEN not set!');
  if (!TRINKS_KEY) console.warn('⚠️  TRINKS_API_KEY not set!');
});
