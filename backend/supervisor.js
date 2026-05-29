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

// --- Chamada Supervisor (TESS 46590) ---
async function classifyConversation({ phone, client, messages }) {
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

// --- Renderizacao da msg pro Tiago ---
function renderDigest({ items, lookbackHours }) {
  if (items.length === 0) {
    return `🌅 Resumo matinal — sem conversas das ultimas ${lookbackHours}h precisando da sua atencao. Bom dia!`;
  }
  const lines = [`🌅 Bom dia! Top ${items.length} conversa(s) das ultimas ${lookbackHours}h pra voce olhar:\n`];
  items.forEach((it, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const score = String(it.score).padStart(3, ' ');
    const cat = it.verdict?.categoria || '?';
    const reason = (it.verdict?.reason_for_human || '').slice(0, 250);
    const action = (it.verdict?.suggested_action || '').slice(0, 160);
    lines.push(
      `${num}. [${score}] ${it.phone} — ${cat}\n` +
      `   ${reason}\n` +
      (action ? `   ➤ ${action}\n` : '')
    );
  });
  lines.push(`\nLinks diretos: abre o WhatsApp do salao e procura cada numero.`);
  return lines.join('\n');
}

// --- Camada 1 (Supervisor v2): pré-filtro + robustez ---
// AC2: "cliente falou por último" = última msg role='user' (cliente aguardando resposta).
// `messages` vem ordenado por created_at (ARRAY_AGG ... ORDER BY) em fetchRecentConversations.
function clientSpokeLast(conv) {
  const msgs = conv?.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return false;
  return msgs[msgs.length - 1]?.role === 'user';
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
  // AC2: filtro duro — só conversas onde o cliente falou por último (aguardando salão).
  // Remove os 3 baldes de falso-positivo do Gabriel: já-respondidas + já-agendadas + cliente-sumiu
  // (todos terminam com o salão/bot falando por último).
  const conversations = allConversations.filter(clientSpokeLast);
  console.log(
    `[supervisor] ${allConversations.length} conversas distintas (${lookbackHours}h); ` +
    `${conversations.length} com cliente aguardando resposta (filtradas ${allConversations.length - conversations.length})`
  );

  // AC5: classificação com concorrência limitada (não sequencial) — evita o travamento visto com 131 convos.
  const verdictsRaw = await mapWithConcurrency(conversations, CLASSIFY_CONCURRENCY, async (conv) => {
    try {
      const client = await fetchClientInfo(conv.client_phone);
      const verdict = await classifyConversation({
        phone: conv.client_phone,
        client,
        messages: conv.messages,
      });
      return { phone: conv.client_phone, verdict, score: scoreFromVerdict(verdict), msg_count: conv.msg_count };
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
  // AC4: métricas do funil (total → aguardando → classificadas → sinalizadas).
  console.log(
    `[supervisor] funil: total=${allConversations.length} aguardando=${conversations.length} ` +
    `classificadas=${verdicts.length} sinalizadas=${ranked.length} | ${Date.now()-startTime}ms`
  );

  if (isDryRun) {
    console.log('[supervisor] DRY RUN — nao envia ao Tiago. Texto:\n' + text);
    return { text, ranked, lookbackHours };
  }
  const recipients = [...new Set([TIAGO_PHONE, ...SUPERVISOR_EXTRA_PHONES].filter(Boolean))];
  if (!recipients.length) {
    console.warn('[supervisor] nenhum destinatario (TIAGO_NOTIFICATION_PHONE / SUPERVISOR_EXTRA_PHONES) — nao envia digest');
    return { text, ranked, lookbackHours };
  }
  if (!kapsoPhoneNumberId) {
    console.warn('[supervisor] kapsoPhoneNumberId ausente — nao envia digest');
    return { text, ranked, lookbackHours };
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
  return { text, ranked, lookbackHours };
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
  // Expostos para testes (Supervisor v2 Camada 1)
  clientSpokeLast,
  mapWithConcurrency,
};
