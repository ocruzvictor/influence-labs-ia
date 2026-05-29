/**
 * Supervisor matinal — triagem priorizada de conversas fora-de-horario.
 *
 * Roda 7h ter-sex e sab no fuso America/Sao_Paulo (cron interno).
 * Coleta conversas das ultimas N horas (terca: 48h porque dom+seg sao fechados),
 * chama TESS Supervisor (agent 46590) por conversa, agrega top N priorizado,
 * envia WhatsApp pro TIAGO_NOTIFICATION_PHONE com lista numerada.
 *
 * Sem dependencia externa de cron — usamos setInterval com guarda diaria.
 */

const db = require('./db');
const { normalizePhoneBR } = require('./lib/trinks-mapping');

const SUPERVISOR_AGENT_ID = process.env.SUPERVISOR_AGENT_ID || '46590';
const TESS_API_BASE = (process.env.TESS_API_BASE || 'https://api.tess.im').replace(/\/+$/, '');
const SUPERVISOR_URL = `${TESS_API_BASE}/agents/${SUPERVISOR_AGENT_ID}/execute`;
const TESS_TOKEN = process.env.TESS_API_TOKEN;
const TIAGO_PHONE = (process.env.TIAGO_NOTIFICATION_PHONE || '').replace(/\D/g, '');
// Destinatários EXTRAS do resumo matinal (além do Tiago). CSV de números (só dígitos).
// Separado de TIAGO_NOTIFICATION_PHONE de propósito: só afeta o resumo — NÃO mexe no
// pedido-de-ajuda (takeover) nem na identidade "msg veio do Tiago" do server.js.
const SUPERVISOR_EXTRA_PHONES = (process.env.SUPERVISOR_EXTRA_PHONES || '')
  .split(',')
  .map((p) => p.replace(/\D/g, ''))
  .filter(Boolean);
const TOP_N = parseInt(process.env.SUPERVISOR_TOP_N || '10', 10);
const SALON_TZ = 'America/Sao_Paulo';

// --- Config Kapso (fonte do last-speaker — Supervisor v2 Camada 1, rota A: pull no digest) ---
// O endpoint NATIVO Kapso (`/platform/v1/whatsapp/messages`) usa KAPSO_API_BASE_URL na skill
// observe-whatsapp. O server.js usa KAPSO_API_BASE (proxy Meta) — provavelmente o MESMO host
// (api.kapso.ai), mas resolvemos com fallback p/ não morrer se um dos dois não estiver setado.
// Se a base escolhida NÃO servir /platform/v1, o fetch falha → fail-OPEN logado (não trava o digest).
// Lidas LAZY (dentro do fetch) — env pode ser setado após o require (testes) e o VPS injeta em runtime.
function getKapsoApiBaseUrl() {
  return (process.env.KAPSO_API_BASE_URL || process.env.KAPSO_API_BASE || '').replace(/\/+$/, '');
}
// PIN do phone_number_id (evita reincidência do no-op por cache em memória frio pós-restart):
// lastKnownKapsoPhoneNumberId (server.js:1110) || env || hardcode confirmado em prod.
const KAPSO_PHONE_NUMBER_ID_FALLBACK = '1016003164939443';
// Quantas msgs por página e teto de páginas — evita loop infinito; loga page_cap_hit se truncar.
// ⚠️ Máximo aceito pela API Kapso = 100 (limit=200 → 400 "Invalid limit parameter"; probado em prod).
const KAPSO_PAGE_LIMIT = parseInt(process.env.KAPSO_PAGE_LIMIT || '100', 10);
const KAPSO_MAX_PAGES = parseInt(process.env.KAPSO_MAX_PAGES || '50', 10);
const KAPSO_FETCH_TIMEOUT_MS = parseInt(process.env.KAPSO_FETCH_TIMEOUT_MS || '20000', 10);

// --- Helpers de tempo (fuso salao) ---
function getSalonTimeParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TZ, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = t => parts.find(p => p.type === t)?.value;
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour: parseInt(pick('hour'), 10), minute: parseInt(pick('minute'), 10), weekday: wdMap[pick('weekday')] };
}

// Lookback dinamico baseado em politica de fechamento:
//   - Ter (cron 7h): pega desde sab 17:30 BRT (= 30min antes do fechamento de sab 18h).
//     Distancia ter 07:00 -> sab 17:30 = 61h30min. Usamos 62h por seguranca.
//   - Outros dias (qua-sab): 24h cobre desde 7h do dia anterior (dentro do horario comercial),
//     entao nao perde mensagens.
function getLookbackHours(date = new Date()) {
  const { weekday } = getSalonTimeParts(date);
  if (weekday === 2) return 62; // terca
  return 24;
}

// --- Coleta de conversas ---
async function fetchRecentConversations(lookbackHours) {
  const r = await db.query(
    `SELECT client_phone,
            MAX(created_at) AS last_ts,
            COUNT(*) AS msg_count,
            ARRAY_AGG(JSON_BUILD_OBJECT('role', role, 'content', content, 'ts', created_at) ORDER BY created_at) AS messages
     FROM conversation_history
     WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
     GROUP BY client_phone
     ORDER BY MAX(created_at) DESC`,
    [String(lookbackHours)]
  );
  return r?.rows || [];
}

async function fetchClientInfo(phone) {
  const r = await db.query(
    `SELECT name, last_service, last_visit, visit_count
     FROM clients WHERE phone = $1`,
    [phone]
  );
  return r?.rows?.[0] || null;
}

// AC3 (sinal, não filtro): agendamentos FUTUROS ativos por telefone normalizado.
// Retorna Map<phoneNorm, {tem:true, quando, status}> (o mais próximo por telefone).
// FAIL-OPEN: erro de DB → Map vazio (booking é só sinal pro agente, nunca derruba o digest).
async function fetchFutureBookings() {
  try {
    const r = await db.query(
      `SELECT client_phone, scheduled_at, status
       FROM trinks_appointments
       WHERE scheduled_at >= NOW() AND status NOT IN ('cancelled', 'no_show')
       ORDER BY scheduled_at ASC`
    );
    const map = new Map();
    for (const row of r?.rows || []) {
      const p = normalizePhoneBR(row.client_phone);
      if (!p || map.has(p)) continue; // ASC → o primeiro por telefone é o mais próximo
      map.set(p, { tem: true, quando: row.scheduled_at, status: row.status });
    }
    return map;
  } catch (err) {
    console.warn(`[supervisor] fetchFutureBookings falhou (sinal de agendamento desativado): ${err.message}`);
    return new Map();
  }
}

// AC6: horário da última mensagem do CLIENTE (role='user'), pro Gabriel encaixar no FIFO.
function lastClientMsgTs(conv) {
  const msgs = conv?.messages;
  if (Array.isArray(msgs)) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user' && msgs[i]?.ts) return msgs[i].ts;
    }
  }
  return conv?.last_ts || null;
}

// AC8: formata um timestamp como HH:MM no fuso do salão (pro digest escaneável).
function formatArrival(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SALON_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

// --- Chamada Supervisor (TESS 46590) ---
// AC6 (Camada 2): input enriquecido com os sinais "fura-fila" — quem falou por último
// (reusa o Map Kapso do AC2, NÃO recomputa), se tem agendamento futuro (sinal, não filtro — AC3),
// e o horário da última msg do cliente (pro Gabriel encaixar no FIFO).
async function classifyConversation({
  phone, client, messages,
  quemFalouPorUltimo = null, temAgendamento = null, horarioUltimaMsgCliente = null,
}) {
  const recent = messages.slice(-12); // ultimas 12 msgs por conversa
  const input = {
    CONVERSATION_ID: phone,
    ULTIMAS_MENSAGENS: recent.map(m => ({ role: m.role, content: m.content, ts: m.ts })),
    DADOS_CLIENTE: client ? {
      nome: client.name,
      visitas: client.visit_count || 0,
      ultimo_servico: client.last_service,
      ultima_visita: client.last_visit,
    } : null,
    QUEM_FALOU_POR_ULTIMO: quemFalouPorUltimo, // 'cliente' | 'salao' | null
    TEM_AGENDAMENTO: temAgendamento || { tem: false }, // {tem, quando, status} — SINAL pro agente
    HORARIO_ULTIMA_MSG_CLIENTE: horarioUltimaMsgCliente, // ISO | null
    TIPO_DE_VARREDURA: 'cron',
    TAG_ACIONADORA: null,
  };
  const body = {
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    wait_execution: true,
  };
  const res = await fetch(SUPERVISOR_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Supervisor TESS ${res.status}: ${await res.text().catch(()=>'')}`);
  const json = await res.json();
  const raw = json?.responses?.[0]?.output || json?.output || '';
  try {
    // Strip code fences se vierem.
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.warn(`[supervisor] parse falhou phone=${phone}: ${err.message} | raw=${raw.slice(0, 200)}`);
    return null;
  }
}

// --- Score: extrai priority_score do JSON. Se faltar, usa heuristica por severity. ---
function scoreFromVerdict(v) {
  if (!v) return 0;
  if (Number.isFinite(v.priority_score)) return Math.max(0, Math.min(100, v.priority_score));
  // Fallback heuristico
  const sevMap = { high: 90, med: 60, low: 30 };
  const catBonus = {
    reclamacao: 10, pedido_humano: 5, conflito_agenda: 10,
    qualidade_ruim: 5, silencio_meio_conversa: 0, falso_positivo: 0,
  };
  const base = sevMap[v.severity] || 0;
  const bonus = catBonus[v.categoria] || 0;
  if (v.decision === 'escalate') return Math.min(100, base + bonus);
  if (v.decision === 'monitor') return Math.min(60, base);
  return 0;
}

// --- Renderizacao da msg (AC8: híbrido "fura-fila") ---
// Enquadra como "estes furam sua fila — atenda primeiro, depois siga o FIFO normal".
// Cada item: horário de chegada (FIFO) + categoria + motivo + ação. Vazio → mensagem positiva.
function renderDigest({ items, lookbackHours }) {
  if (items.length === 0) {
    return `🌅 Bom dia! Nada fura a fila hoje — pode seguir sua ordem de chegada normal. 🙌`;
  }
  const lines = [
    `🌅 Bom dia! ${items.length} conversa(s) que furam a fila — atenda primeiro, ` +
    `depois siga sua ordem de chegada normal:\n`,
  ];
  items.forEach((it, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const cat = it.verdict?.categoria || '?';
    const reason = (it.verdict?.reason_for_human || '').slice(0, 250);
    const action = (it.verdict?.suggested_action || '').slice(0, 160);
    const hora = formatArrival(it.last_client_ts);
    const book = it.tem_agendamento?.tem ? ' · 📅 já tem agendamento' : '';
    lines.push(
      `${num}. ${it.phone} — ${cat}${hora ? ` · chegou ${hora}` : ''}${book}\n` +
      `   ${reason}\n` +
      (action ? `   ➤ ${action}\n` : '')
    );
  });
  lines.push(`\n➡️ Depois desses, siga normal pela ordem de chegada.`);
  return lines.join('\n');
}

// --- Camada 1 (Supervisor v2): pré-filtro via fonte Kapso + robustez ---
//
// AC2 (rota A — pull Kapso no digest): "quem falou por último" NÃO vem mais de
// conversation_history (bot-only → no-op em prod, removia 0/127). Vem do `kapso.direction`
// da API Kapso (inbound=cliente / outbound=salão, inclusive resposta MANUAL da recepção
// que o conversation_history não vê). Mantém só conversas cuja última msg é `inbound`.
//
// O conversation_history segue como fonte do CONTEÚDO (12 msgs → TESS) — híbrido intacto.

// Extrai o telefone do CONTATO (cliente) de uma msg Kapso, direction-aware.
// CRÍTICO (alerta do @architect): em `outbound`, `from`=número do salão e `to`=cliente.
// Nunca usar `from` cego. Preferimos campos do contato/conversa; só caímos em from/to por
// direção como último recurso. Normalizado com normalizePhoneBR (mesmo join da Story 1.6).
// ✅ RISCO #1 RESOLVIDO (probe read-only em prod, @devops 2026-05-29): o campo do telefone do
// CLIENTE é `kapso.phone_number` — ESTÁVEL nas duas direções (inbound: from=cliente=kapso.phone_number;
// outbound: from=número do salão fixo, kapso.phone_number=cliente). É a chave de join primária.
// Os demais candidatos ficam como fallback defensivo p/ drift de payload.
function extractContactPhone(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const k = msg.kapso || {};
  const conv = msg.conversation || k.conversation || {};
  const direction = msg.direction || k.direction;

  // 1) Telefone do contato/conversa (independe da direção — fonte mais segura).
  //    `k.phone_number` é o campo REAL confirmado em prod; os outros são fallback defensivo.
  const contactCandidates = [
    k.phone_number,
    conv.phone_number, conv.contact_phone, conv.customer_phone,
    msg.contact_phone, msg.customer_phone,
    msg.contact && msg.contact.phone_number, msg.contact && msg.contact.phone,
    k.contact_phone,
    msg.whatsapp_conversation && msg.whatsapp_conversation.phone_number,
  ];
  for (const c of contactCandidates) {
    const norm = normalizePhoneBR(c);
    if (norm) return norm;
  }

  // 2) Fallback por direção: inbound → cliente é o `from`. (No payload real o outbound NÃO traz
  //    `to`; por isso `kapso.phone_number` acima é a fonte — este galho é só rede de segurança.)
  const directional = direction === 'outbound' ? (msg.to ?? k.to) : (msg.from ?? k.from);
  return normalizePhoneBR(directional);
}

// Extrai a direção (inbound/outbound) de uma msg Kapso de forma defensiva.
function extractDirection(msg) {
  return (msg && (msg.direction || (msg.kapso && msg.kapso.direction))) || null;
}

// Extrai o timestamp (ms) de uma msg Kapso, tolerante a vários nomes de campo.
function extractTimestampMs(msg) {
  const k = (msg && msg.kapso) || {};
  const raw = msg && (msg.timestamp ?? msg.created_at ?? msg.sent_at ?? k.timestamp ?? k.created_at);
  if (raw == null) return 0;
  // Epoch em segundos (10 díg) vem da Meta; ISO string vem da REST nativa.
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
    const n = Number(raw);
    return n < 1e12 ? n * 1000 : n; // segundos → ms
  }
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

// Reduz uma lista de msgs Kapso → Map<phoneNorm, 'inbound'|'outbound'> guardando a direção
// da msg de MAIOR timestamp por telefone. PURA (sem I/O) — testável sem mockar fetch.
// Como guardamos só o max-timestamp, a ORDEM dentro/entre páginas é irrelevante (só importa
// cobrir a janela inteira — ver paginação em fetchKapsoLastSpeaker).
function buildLastSpeakerMap(messages) {
  const map = new Map();
  const bestTs = new Map();
  let matchedPhones = 0;
  let messagesWithTs = 0; // quantas msgs tiveram timestamp PARSEÁVEL (ts > 0)
  for (const msg of messages || []) {
    const phone = extractContactPhone(msg);
    const direction = extractDirection(msg);
    if (!phone || !direction) continue;
    const ts = extractTimestampMs(msg);
    if (ts > 0) messagesWithTs++;
    const prev = bestTs.get(phone);
    if (prev === undefined || ts >= prev) {
      if (prev === undefined) matchedPhones++;
      bestTs.set(phone, ts);
      map.set(phone, direction);
    }
  }
  return { map, matchedPhones, messagesSeen: (messages || []).length, messagesWithTs };
}

// Pull paginado do endpoint NATIVO Kapso, cobrindo TODA a janela de lookback.
// Account-level: 1 sequência de chamadas (não 1 por conversa). Cursor `after` defensivo
// (vários envelopes possíveis). Retorna lista crua de msgs (build do Map é separado/puro).
// `fetchImpl` injetável p/ testes (default = global fetch).
async function fetchKapsoMessagesRaw({ phoneNumberId, lookbackHours, fetchImpl = fetch }) {
  const baseUrl = getKapsoApiBaseUrl();
  const apiKey = process.env.KAPSO_API_KEY;
  if (!phoneNumberId) throw new Error('phone_number_id ausente');
  if (!baseUrl) throw new Error('KAPSO_API_BASE_URL/KAPSO_API_BASE ausente');
  if (!apiKey) throw new Error('KAPSO_API_KEY ausente');

  const windowStartMs = Date.now() - lookbackHours * 3600_000;
  const all = [];
  let after = null;
  let pages = 0;
  let pageCapHit = false;
  // Fix #3 (truncamento barulhento): rastreia COMO o loop terminou + a msg mais antiga vista.
  // "page_cap_hit" sem cobrir a janela = truncamento silencioso → tem que aparecer no diag.
  let termination = 'page_cap_hit';
  let globalOldestTs = Number.POSITIVE_INFINITY;

  while (pages < KAPSO_MAX_PAGES) {
    pages++;
    const params = new URLSearchParams();
    params.set('phone_number_id', String(phoneNumberId));
    params.set('limit', String(KAPSO_PAGE_LIMIT));
    if (after) params.set('after', String(after));
    const url = `${baseUrl}/platform/v1/whatsapp/messages?${params.toString()}`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(KAPSO_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Kapso messages ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    // Envelope defensivo: data[] | messages[] | array cru.
    const batch = Array.isArray(json) ? json
      : (json.data || json.messages || json.items || []);
    all.push(...batch);

    // Stop por janela: se a página mais antiga já passou do início da janela, paramos.
    const oldestTs = batch.reduce((min, m) => {
      const t = extractTimestampMs(m);
      return t > 0 && t < min ? t : min;
    }, Number.POSITIVE_INFINITY);
    if (Number.isFinite(oldestTs) && oldestTs < globalOldestTs) globalOldestTs = oldestTs;
    const coveredWindow = Number.isFinite(oldestTs) && oldestTs < windowStartMs;

    // Cursor: envelope REAL confirmado em prod = `paging.next` (keyset DESC, after avança p/
    // msgs mais antigas — probe @devops 2026-05-29). Demais formas ficam como fallback defensivo.
    const paging = json.paging || {};
    const meta = json.meta || json.pagination || {};
    const nextCursor = paging.next ?? (paging.cursors && paging.cursors.after)
      ?? meta.next_cursor ?? meta.after ?? json.next_cursor ?? json.after ?? null;
    const hasMore = (meta.has_more ?? json.has_more) === true || (nextCursor != null && nextCursor !== after);

    if (batch.length === 0) { termination = 'empty_batch'; break; }
    if (coveredWindow) { termination = 'covered_window'; break; }
    if (!hasMore || !nextCursor) { termination = 'hasMore_exhausted'; break; }
    after = nextCursor;
  }
  if (pages >= KAPSO_MAX_PAGES) pageCapHit = true;
  // window_fully_covered: terminamos porque cobrimos a janela OU esgotamos as msgs disponíveis.
  // Se paramos por teto de páginas SEM cobrir a janela → truncamento (loud no diag).
  const windowFullyCovered = termination === 'covered_window' || termination === 'hasMore_exhausted' || termination === 'empty_batch';
  return { messages: all, pages, pageCapHit, termination, windowFullyCovered, oldestMsgTs: globalOldestTs, windowStartMs };
}

// Orquestra fetch + build do Map. Retorna o Map + métricas de diagnóstico (AC4),
// OU { ok:false } se a Kapso estiver indisponível (→ fail-OPEN no chamador).
async function fetchKapsoLastSpeaker({ phoneNumberId, lookbackHours, fetchImpl } = {}) {
  try {
    const { messages, pages, pageCapHit, termination, windowFullyCovered } = await fetchKapsoMessagesRaw({
      phoneNumberId, lookbackHours, fetchImpl,
    });
    const { map, matchedPhones, messagesSeen, messagesWithTs } = buildLastSpeakerMap(messages);
    // 4º disfarce do no-op: se o campo de timestamp da Kapso tiver outro nome (não probado),
    // extractTimestampMs devolve 0 pra TUDO → "max-timestamp" degrada p/ "última na ordem do
    // fetch" (arbitrária) → o filtro ranqueia em ruído sem ninguém ver. Se buscamos msgs mas
    // NENHUMA tem ts parseável, tratamos Kapso como NÃO-CONFIÁVEL → fail-OPEN loud (mesmo
    // movimento do 5xx). Melhor bypassar visível do que filtrar errado invisível.
    if (messagesSeen > 0 && messagesWithTs === 0) {
      return {
        ok: false,
        error: 'kapso_timestamps_unparseable (msgs sem campo de timestamp reconhecido)',
        map: null,
        diag: { kapso_msgs_fetched: messagesSeen, distinct_phones_in_map: 0, kapso_msgs_with_ts: 0, pages, page_cap_hit: pageCapHit, termination, window_fully_covered: windowFullyCovered },
      };
    }
    return {
      ok: true, map,
      diag: { kapso_msgs_fetched: messagesSeen, distinct_phones_in_map: matchedPhones, kapso_msgs_with_ts: messagesWithTs, pages, page_cap_hit: pageCapHit, termination, window_fully_covered: windowFullyCovered },
    };
  } catch (err) {
    return { ok: false, error: err.message, map: null, diag: { kapso_msgs_fetched: 0, distinct_phones_in_map: 0, kapso_msgs_with_ts: 0, pages: 0, page_cap_hit: false, termination: 'error', window_fully_covered: false } };
  }
}

// AC2: cliente falou por último, via Map Kapso. FAIL-OPEN por item:
//   - Kapso indisponível (map=null) → mantém TODAS (bypass — sinalizado no chamador).
//   - telefone não casa no Map (variância 9º dígito BR etc.) → MANTÉM (nunca dropa por dúvida).
//   - só EXCLUI quando há certeza positiva de outbound.
function clientSpokeLastKapso(conv, lastSpeakerMap) {
  if (!lastSpeakerMap) return true; // fail-open global (Kapso indisponível)
  const phone = normalizePhoneBR(conv?.client_phone);
  if (!phone) return true; // telefone da conversa não normaliza → fail-open por item
  const dir = lastSpeakerMap.get(phone);
  if (dir === undefined) return true; // não casou no Map → fail-open por item
  return dir === 'inbound'; // certeza positiva: outbound → exclui; inbound → mantém
}

// AC5: map com concorrência limitada (substitui o loop sequencial que travava com 131 convos).
// Cada item tem timeout próprio (AbortSignal em classifyConversation), então o pool tem teto de tempo.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

const CLASSIFY_CONCURRENCY = 4;

// --- Pipeline completo ---
async function runMorningTriage({ sendKapsoMessage, kapsoPhoneNumberId, isDryRun = false } = {}) {
  const startTime = Date.now();
  const lookbackHours = getLookbackHours();
  console.log(`[supervisor] triagem matinal iniciada (lookback=${lookbackHours}h, dryRun=${isDryRun})`);

  const allConversations = await fetchRecentConversations(lookbackHours);

  // AC2 (fonte Kapso): "quem falou por último" vem da API Kapso (kapso.direction), NÃO do
  // conversation_history (bot-only → no-op em prod). 1 pull paginado account-level por run.
  // PIN do phone_number_id (evita reincidência do no-op por cache em memória frio pós-restart):
  //   webhook cache → env → hardcode confirmado em prod.
  const pinnedPhoneNumberId =
    kapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID || KAPSO_PHONE_NUMBER_ID_FALLBACK;
  const lastSpeaker = await fetchKapsoLastSpeaker({ phoneNumberId: pinnedPhoneNumberId, lookbackHours });

  // FAIL-OPEN: Kapso indisponível → não filtra (classifica TODAS). Logado DISTINTAMENTE do
  // "filtro rodou e manteve N" — conflar os dois foi exatamente como o no-op da v1 passou.
  const kapsoIndisponivel = !lastSpeaker.ok;
  if (kapsoIndisponivel) {
    console.warn(
      `[supervisor] kapso_indisponivel=true → filtro last-speaker BYPASSED (classifica tudo). ` +
      `motivo="${lastSpeaker.error}"`
    );
  }
  // AC2: mantém só conversas com última msg INBOUND (cliente aguardando). Fail-open por item
  // dentro de clientSpokeLastKapso (telefone sem match → mantém; só exclui outbound certo).
  const conversations = allConversations.filter((c) => clientSpokeLastKapso(c, lastSpeaker.map));
  const matchedInMap = lastSpeaker.map
    ? allConversations.filter((c) => {
        const p = normalizePhoneBR(c.client_phone);
        return p && lastSpeaker.map.has(p);
      }).length
    : 0;
  const excludedOutbound = allConversations.length - conversations.length;

  // AC3 (Camada 2): sinal de agendamento futuro por telefone (1 query, fail-open). NÃO filtra.
  const bookingMap = await fetchFutureBookings();

  // AC5: classificação com concorrência limitada (não sequencial) — evita o travamento visto com 131 convos.
  const verdictsRaw = await mapWithConcurrency(conversations, CLASSIFY_CONCURRENCY, async (conv) => {
    try {
      const client = await fetchClientInfo(conv.client_phone);
      // AC6: sinais "fura-fila" derivados (reusa o Map Kapso do AC2 — não recomputa).
      const phoneNorm = normalizePhoneBR(conv.client_phone);
      const dir = phoneNorm && lastSpeaker.map ? lastSpeaker.map.get(phoneNorm) : undefined;
      const quemFalouPorUltimo = dir === 'inbound' ? 'cliente' : dir === 'outbound' ? 'salao' : null;
      const temAgendamento = (phoneNorm && bookingMap.get(phoneNorm)) || { tem: false };
      const horarioUltimaMsgCliente = lastClientMsgTs(conv);
      const verdict = await classifyConversation({
        phone: conv.client_phone,
        client,
        messages: conv.messages,
        quemFalouPorUltimo,
        temAgendamento,
        horarioUltimaMsgCliente,
      });
      return {
        phone: conv.client_phone, verdict, score: scoreFromVerdict(verdict), msg_count: conv.msg_count,
        last_client_ts: horarioUltimaMsgCliente, tem_agendamento: temAgendamento,
      };
    } catch (err) {
      console.error(`[supervisor] erro classificando ${conv.client_phone}: ${err.message}`);
      return null;
    }
  });
  const verdicts = verdictsRaw.filter(Boolean);

  // Filtra ignore e ordena por score desc
  const ranked = verdicts
    .filter(v => v.verdict && v.verdict.decision !== 'ignore' && v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  const text = renderDigest({ items: ranked, lookbackHours });
  // AC4: funil DIAGNÓSTICO. Estende os campos literais c/ contadores de estágio que
  // distinguem os 3 disfarces do no-op (lição da v1: 44/44 unit verde + filtro morto):
  //   - kapso_indisponivel=true  → filtro BYPASSED (mantém tudo por design)
  //   - matched=0 (com Kapso ok) → JOIN QUEBRADO (telefone não casa) ← "127→0" de chapéu novo
  //   - matched alto, excluidos>0 → filtro FUNCIONANDO
  // Sem isso, "manteve 127 de 127" lê idêntico a "127 legitimamente aguardando".
  const funil = {
    total_conversas: allConversations.length,
    kapso_indisponivel: kapsoIndisponivel,
    kapso_msgs_fetched: lastSpeaker.diag.kapso_msgs_fetched,
    kapso_msgs_with_ts: lastSpeaker.diag.kapso_msgs_with_ts,
    distinct_phones_in_map: lastSpeaker.diag.distinct_phones_in_map,
    conversations_matched_in_map: matchedInMap,
    excluded_outbound: excludedOutbound,
    page_cap_hit: lastSpeaker.diag.page_cap_hit,
    termination: lastSpeaker.diag.termination,
    window_fully_covered: lastSpeaker.diag.window_fully_covered,
    apos_filtro_last_speaker: conversations.length,
    enviadas_tess: conversations.length,
    classificadas: verdicts.length,
    sinalizadas: ranked.length,
    ms: Date.now() - startTime,
  };
  console.log(`[supervisor] funil: ${JSON.stringify(funil)}`);
  if (lastSpeaker.diag.page_cap_hit) {
    console.warn('[supervisor] page_cap_hit=true → pode ter truncado a janela antes de cobri-la (aumentar KAPSO_MAX_PAGES)');
  }
  // Fix #3: truncamento silencioso barulhento — janela NÃO coberta (sem ser cap) também alerta.
  if (lastSpeaker.ok && lastSpeaker.diag.window_fully_covered === false) {
    console.warn(`[supervisor] window_fully_covered=false (termination=${lastSpeaker.diag.termination}) → janela pode ter sido truncada; filtro opera sobre amostra parcial`);
  }

  if (isDryRun) {
    console.log('[supervisor] DRY RUN — nao envia ao Tiago. Texto:\n' + text);
    return { text, ranked, lookbackHours, funil };
  }
  const recipients = [...new Set([TIAGO_PHONE, ...SUPERVISOR_EXTRA_PHONES].filter(Boolean))];
  if (!recipients.length) {
    console.warn('[supervisor] nenhum destinatario (TIAGO_NOTIFICATION_PHONE / SUPERVISOR_EXTRA_PHONES) — nao envia digest');
    return { text, ranked, lookbackHours, funil };
  }
  if (!kapsoPhoneNumberId) {
    console.warn('[supervisor] kapsoPhoneNumberId ausente — nao envia digest');
    return { text, ranked, lookbackHours, funil };
  }
  // Envia a cada destinatario de forma independente (falha em um nao bloqueia os outros).
  for (const phone of recipients) {
    try {
      await sendKapsoMessage(phone, text, kapsoPhoneNumberId);
      console.log(`[supervisor] digest enviado a ${phone}`);
    } catch (err) {
      console.error(`[supervisor] falha ao enviar digest a ${phone}: ${err.message}`);
    }
  }
  return { text, ranked, lookbackHours, funil };
}

// --- Scheduler simples (sem dependencia externa) ---
// Checa a cada 60s se eh 7:00 no fuso do salao em dias permitidos (ter-sab).
// Guarda dia executado em memoria pra nao rodar duas vezes.
let lastTriageDay = null;
function startScheduler({ sendKapsoMessage, getKapsoPhoneNumberId }) {
  console.log('[supervisor] scheduler iniciado (verifica 7h ter-sab horario salao)');
  setInterval(async () => {
    const { hour, minute, weekday } = getSalonTimeParts();
    if (hour !== 7 || minute > 5) return; // janela 7:00-7:05
    if (weekday === 0 || weekday === 1) return; // domingo e segunda nao rodam
    const today = new Date().toISOString().slice(0, 10);
    if (lastTriageDay === today) return;
    lastTriageDay = today;
    try {
      const phoneNumberId = typeof getKapsoPhoneNumberId === 'function' ? getKapsoPhoneNumberId() : null;
      await runMorningTriage({ sendKapsoMessage, kapsoPhoneNumberId: phoneNumberId });
    } catch (err) {
      console.error('[supervisor] erro no run automatico:', err.message);
    }
  }, 60_000);
}

module.exports = {
  runMorningTriage,
  startScheduler,
  isSalonOpenForTests: getSalonTimeParts,
  // Expostos para testes (Supervisor v2 Camada 1 — fonte Kapso)
  extractContactPhone,
  extractDirection,
  extractTimestampMs,
  buildLastSpeakerMap,
  clientSpokeLastKapso,
  fetchKapsoLastSpeaker,
  fetchKapsoMessagesRaw,
  mapWithConcurrency,
  // Expostos para testes (Supervisor v2 Camada 2 — input enriquecido + render híbrido)
  classifyConversation,
  fetchFutureBookings,
  lastClientMsgTs,
  formatArrival,
  renderDigest,
};
