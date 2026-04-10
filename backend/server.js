/**
 * Studio Tirra — Webchat Backend (substitui n8n cloud)
 *
 * Fluxo: POST /webhook/demo-chat
 *   1. Parse payload { message, session_id, contact_name }
 *   2. Consulta Trinks API em paralelo (horários + profissionais)
 *   3. Monta contexto dinamico compacto
 *   4. Chama TESS API (agent configuravel) com contexto dinamico da Trinks
 *   5. Parse resposta — detecta [BOOKING_REQUEST] / [BOOKING_CONFIRM]
 *   6. Se booking: consulta Trinks para horários específicos + 2ª chamada TESS
 *   7. Retorna { response, timestamp }
 */

const express = require('express');
const cors = require('cors');

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

function buildDynamicContext(businessDays, slotsText, professionalsText) {
  return [
    DYNAMIC_CONTEXT_PREFIX,
    `HOJE: ${formatFullDateLabel(getTodayIsoInSalonTimeZone())}`,
    'HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO',
    `DATAS COM DADOS DISPONIVEIS: ${businessDays.map(formatDateLabel).join(', ')}`,
    '',
    slotsText,
    professionalsText,
  ].join('\n');
}

function buildAvailabilityContext(slotsText) {
  return [
    'CONTEXTO DINAMICO - DISPONIBILIDADE CONFIRMADA VIA TRINKS:',
    `HOJE: ${formatFullDateLabel(getTodayIsoInSalonTimeZone())}`,
    '',
    String(slotsText || '').trim(),
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
    if (!json.data || !Array.isArray(json.data)) return 'PROFISSIONAIS: Erro ao consultar.';
    let txt = 'PROFISSIONAIS ATIVOS:\n';
    for (const p of json.data) {
      txt += `- ${p.apelido || p.nome} (ID ${p.id})\n`;
    }
    return txt;
  } catch (err) {
    console.error('Trinks professionals error:', err.message);
    return 'PROFISSIONAIS: Erro ao consultar.';
  }
}

// --- TESS helper ---
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
  const candidates = [
    raw?.root_id,
    raw?.responses?.[0]?.root_id,
    raw?.data?.root_id,
    raw?.execution?.root_id,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return null;
}

function parseBookingTags(response) {
  let clientMessage = response;
  let bookingRequest = null;
  let bookingConfirm = null;

  const reqMatch = response.match(/\[BOOKING_REQUEST\]\s*\n?({[\s\S]*?})/i);
  if (reqMatch) {
    try { bookingRequest = JSON.parse(reqMatch[1]); } catch {}
    clientMessage = clientMessage.replace(reqMatch[0], '').trim();
  }

  const confMatch = response.match(/\[BOOKING_CONFIRM\]\s*\n?({[\s\S]*?})/i);
  if (confMatch) {
    try { bookingConfirm = JSON.parse(confMatch[1]); } catch {}
    clientMessage = clientMessage.replace(confMatch[0], '').trim();
  }

  return { clientMessage, bookingRequest, bookingConfirm };
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

// --- Booking execution (Trinks) ---
async function executeBooking(bookingRequest, bookingConfirm) {
  if (bookingRequest?.action === 'check_availability') {
    const date = bookingRequest.date;
    try {
      const json = await fetchTrinks(`/agendamentos/profissionais/${date}`);
      let txt = `HORARIOS VAGOS ${formatDateLabel(date)}:\n`;
      let found = false;
      if (json.data) {
        for (const p of json.data) {
          if (bookingRequest.professional_id && p.id !== bookingRequest.professional_id) continue;
          if (p.horariosVagos?.length) {
            found = true;
            txt += `- ${p.apelido || p.nome}: ${p.horariosVagos.join(', ')}\n`;
          }
        }
      }
      if (!found) txt += 'Nenhum horario disponivel.';
      return { type: 'availability', slots: txt };
    } catch (err) {
      return { type: 'error', message: err.message };
    }
  }

  if (bookingConfirm?.action === 'create_booking') {
    return {
      type: 'booking_pending',
      message: `Booking para ${bookingConfirm.client_name}: ${bookingConfirm.service_name} em ${bookingConfirm.date_time}. Pendente ServicoEstabelecimentoId.`,
    };
  }

  return null;
}

// --- Main endpoint ---
app.post('/webhook/demo-chat', async (req, res) => {
  const startTime = Date.now();
  const globalTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[TIMEOUT] Global 28s timeout hit`);
      res.json({ response: 'Estou demorando mais que o normal. Pode tentar de novo?', timestamp: new Date().toISOString() });
    }
  }, 28000);

  try {
    // 1. Parse payload
    const { message, session_id, contact_name = 'Visitante', history: incomingHistoryRaw } = req.body;
    const sessionId = String(session_id || 'anonymous');
    const state = sessionState.get(sessionId) || { turn: 0, rootId: null, history: [] };
    if (!message || !message.trim()) {
      return res.status(400).json({ response: 'Mensagem vazia', timestamp: new Date().toISOString() });
    }

    const messageText = message.trim();
    // Merge client-side history as fallback (Render cold-start loses sessionState)
    if (state.history.length === 0 && Array.isArray(incomingHistoryRaw) && incomingHistoryRaw.length > 0) {
      state.history = incomingHistoryRaw.filter(m => m.role && m.content).slice(-20);
    }
    console.log(`[${sessionId}] ${contact_name}: "${messageText}"`);

    // 2. Fetch Trinks data in parallel (next 5 business days)
    const businessDays = getNextBusinessDays(5);
    const [slotsResults, profsResult] = await Promise.allSettled([
      Promise.all(businessDays.map(date => getSlots(date))),
      getProfessionals(),
    ]);

    const slotsAll = slotsResults.status === 'fulfilled'
      ? slotsResults.value.join('\n')
      : 'HORARIOS: Erro ao consultar. Peca ao cliente o dia desejado.';
    const profs = profsResult.status === 'fulfilled'
      ? profsResult.value
      : 'PROFISSIONAIS: Erro ao consultar.';
    const dynamicContext = buildDynamicContext(businessDays, slotsAll, profs);

    // 3. Call TESS (1st call) — with conversation history
    const lastEntry = state.history[state.history.length - 1];
    if (lastEntry?.role !== 'user' || lastEntry.content !== messageText) {
      state.history.push({ role: 'user', content: messageText });
    }
    const historyWindow = state.history.slice(-20);
    const tessRaw = await callTESS([
      { role: 'system', content: dynamicContext },
      ...historyWindow,
    ], state.rootId);

    const tessText = extractTESSResponse(tessRaw);
    const rootId = extractTESSRootId(tessRaw);
    if (rootId) state.rootId = rootId;
    if (!tessText) {
      console.error('[TESS] Empty response:', JSON.stringify(tessRaw).slice(0, 300));
      return res.json({
        response: 'Ola! Estou com uma dificuldade tecnica. Nosso atendimento humano entrara em contato em breve!',
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Parse booking tags
    const { clientMessage, bookingRequest, bookingConfirm } = parseBookingTags(tessText);
    const formatted = formatAssistantOutput(clientMessage, state.turn === 0);
    const hasBookingAction = !!(bookingRequest || bookingConfirm);

    // 5. If no booking action, return directly
    if (!hasBookingAction) {
      state.history.push({ role: 'assistant', content: clientMessage });
      state.turn += 1;
      state.lastAccess = Date.now();
      sessionState.set(sessionId, state);
      evictOldSessions();
      console.log(`[${sessionId}] Response (${Date.now() - startTime}ms): "${formatted.response.slice(0, 80)}..."`);
      return res.json({ response: formatted.response, responses: formatted.responses, timestamp: new Date().toISOString() });
    }

    // 6. Execute booking (check availability or create)
    const bookingResult = await executeBooking(bookingRequest, bookingConfirm);

    // 7. If availability check, do 2nd TESS call with specific slots
    if (bookingResult?.type === 'availability') {
      const tess2Raw = await callTESS([
        {
          role: 'system',
          content: buildAvailabilityContext(bookingResult.slots),
        },
        { role: 'user', content: messageText },
      ], state.rootId);

      let response2 = extractTESSResponse(tess2Raw);
      const rootId2 = extractTESSRootId(tess2Raw);
      if (rootId2) state.rootId = rootId2;
      if (!response2) response2 = 'Vou verificar e ja te retorno!';
      // Clean any residual booking tags
      response2 = response2.replace(/\[BOOKING_(?:REQUEST|CONFIRM)\]\s*\n?{[\s\S]*?}/gi, '').trim();
      const formatted2 = formatAssistantOutput(response2, state.turn === 0);

      state.history.push({ role: 'assistant', content: response2 });
      state.turn += 1;
      state.lastAccess = Date.now();
      sessionState.set(sessionId, state);
      evictOldSessions();
      console.log(`[${sessionId}] Response+booking (${Date.now() - startTime}ms): "${formatted2.response.slice(0, 80)}..."`);
      return res.json({ response: formatted2.response, responses: formatted2.responses, timestamp: new Date().toISOString() });
    }

    // 8. For booking_pending or other, return client message
    state.history.push({ role: 'assistant', content: clientMessage });
    state.turn += 1;
    state.lastAccess = Date.now();
    sessionState.set(sessionId, state);
    evictOldSessions();
    console.log(`[${sessionId}] Response+confirm (${Date.now() - startTime}ms): "${formatted.response.slice(0, 80)}..."`);
    return res.json({ response: formatted.response, responses: formatted.responses, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('Handler error:', err);
    if (!res.headersSent) {
      return res.json({
        response: 'Estou com uma dificuldade tecnica no momento. Tente novamente em instantes!',
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    clearTimeout(globalTimeout);
  }
});

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
