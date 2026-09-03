/**
 * Nightwatch read-only ops — last4 only, no raw SQL surface, no Trinks mutate.
 */

const OUTCOME_EVENTS = [
  'booking.created',
  'booking.failed',
  'booking.dropped',
  'booking.cancelled',
  'guard.blocked',
];

const WATCH_EVENTS = [
  ...OUTCOME_EVENTS,
  'tags.parsed',
  'tags.leaked',
  'handoff.human',
  'tess.empty',
  'cancel.not_owned',
];

const SUCCESS_COPY_RE = /confirmado|agendado|garantido|j[aá] marcado|reagendei|cancelei|t[aá] certo|pronto!/i;

function last4FromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function normalizeLast4(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

const DIGIT_RUN_RE = /(?<!\d)(?:\+?\d[\s().-]*){8,}(?!\d)/g;

function redactSnippet(text, max = 140) {
  const s = String(text || '')
    .replace(DIGIT_RUN_RE, '[digits]')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function clampMinutes(n, fallback = 15) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(180, Math.max(5, Math.round(v)));
}

function clampLimit(n, fallback = 12, max = 24) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(1, Math.round(v)));
}

function mapEventRow(row) {
  const last4 = last4FromPhone(row.client_phone);
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const safePayload = {};
  for (const key of ['creates', 'cancels', 'reschedules', 'handoff', 'tagNames', 'outcome']) {
    if (payload[key] !== undefined) safePayload[key] = payload[key];
  }
  return {
    event: row.event,
    last4,
    received_at: row.received_at,
    motivo: redactSnippet(row.motivo, 80) || null,
    payload: safePayload,
  };
}

async function listEvents(db, { minutes = 15, last4 = null } = {}) {
  const windowMin = clampMinutes(minutes);
  const needle = last4 ? normalizeLast4(last4) : null;
  const result = await db.query(
    `SELECT event, client_phone, motivo, payload, received_at
       FROM bot_operational_events
      WHERE received_at >= NOW() - ($1 * INTERVAL '1 minute')
        AND event = ANY($2::text[])
        AND ($3::text IS NULL
             OR RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $3)
      ORDER BY received_at DESC
      LIMIT 80`,
    [windowMin, WATCH_EVENTS, needle],
  );
  return (result?.rows || []).map(mapEventRow);
}

async function listStuckThreads(db, { lookbackHours = 12, stuckAfterMin = 3 } = {}) {
  const hours = Math.min(48, Math.max(1, Number(lookbackHours) || 12));
  const stuckMin = Math.min(30, Math.max(3, Number(stuckAfterMin) || 3));
  const result = await db.query(
    `WITH last AS (
       SELECT DISTINCT ON (client_phone)
              client_phone, role, content, created_at
         FROM conversation_history
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 hour')
        ORDER BY client_phone, created_at DESC
     )
     SELECT client_phone, role, content, created_at
       FROM last
      WHERE role = 'user'
        AND created_at < NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY created_at ASC
      LIMIT 20`,
    [hours, stuckMin],
  );
  return (result?.rows || []).map((row) => ({
    last4: last4FromPhone(row.client_phone),
    role: row.role,
    waiting_min: Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000),
    created_at: row.created_at,
    snippet: redactSnippet(row.content),
  }));
}

async function listOrphans(db, { minutes = 15 } = {}) {
  const windowMin = clampMinutes(minutes);
  const result = await db.query(
    `WITH parsed AS (
       SELECT id,
              received_at,
              client_phone,
              RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) AS last4,
              COALESCE((payload->>'creates')::int, 0) AS creates,
              COALESCE((payload->>'reschedules')::int, 0) AS reschedules
         FROM bot_operational_events
        WHERE event = 'tags.parsed'
          AND received_at >= NOW() - ($1 * INTERVAL '1 minute')
          AND (
            COALESCE((payload->>'creates')::int, 0) > 0
            OR COALESCE((payload->>'reschedules')::int, 0) > 0
          )
     )
     SELECT p.last4, p.received_at, p.creates, p.reschedules
       FROM parsed p
      WHERE p.last4 IS NOT NULL
        AND char_length(p.last4) = 4
        AND NOT EXISTS (
          SELECT 1
            FROM bot_operational_events e
           WHERE e.event = ANY($2::text[])
             AND RIGHT(regexp_replace(COALESCE(e.client_phone, ''), '[^0-9]', '', 'g'), 4) = p.last4
             AND e.received_at BETWEEN p.received_at - INTERVAL '2 minutes'
                                   AND p.received_at + INTERVAL '2 minutes'
        )
      ORDER BY p.received_at DESC
      LIMIT 30`,
    [windowMin, OUTCOME_EVENTS],
  );
  return (result?.rows || []).map((row) => ({
    last4: row.last4,
    received_at: row.received_at,
    creates: Number(row.creates) || 0,
    reschedules: Number(row.reschedules) || 0,
    invariant: 'I1',
    hint: 'tags.parsed sem created/failed/blocked/dropped ±2min',
  }));
}

async function listMutations(db, { minutes = 15 } = {}) {
  const windowMin = clampMinutes(minutes);
  const result = await db.query(
    `SELECT method, endpoint, origin, http_status, requested_at
       FROM trinks_api_requests
      WHERE requested_at >= NOW() - ($1 * INTERVAL '1 minute')
        AND origin LIKE 'agent_mutation_%'
      ORDER BY requested_at DESC
      LIMIT 40`,
    [windowMin],
  );
  return (result?.rows || []).map((row) => ({
    method: row.method,
    endpoint: row.endpoint,
    origin: row.origin,
    http_status: row.http_status,
    requested_at: row.requested_at,
    failed: Number(row.http_status) >= 400,
  }));
}

async function getThread(db, { last4, limit = 12 } = {}) {
  const needle = normalizeLast4(last4);
  if (!needle) {
    return { error: 'last4_required', hint: 'Passe 4 dígitos finais do telefone.' };
  }
  const take = clampLimit(limit);
  const result = await db.query(
    `SELECT role, content, created_at, agent
       FROM conversation_history
      WHERE RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [needle, take],
  );
  const turns = (result?.rows || []).reverse().map((row) => ({
    role: row.role,
    agent: row.agent || null,
    created_at: row.created_at,
    snippet: redactSnippet(row.content, 220),
  }));
  return { last4: needle, turns };
}

function classifyVerify({ assistantText, events, mutations }) {
  const claimed = SUCCESS_COPY_RE.test(assistantText || '');
  const hasCommit = events.some((e) => (
    e.event === 'booking.created'
    || e.event === 'booking.cancelled'
  ));
  const hasOutcome = events.some((e) => OUTCOME_EVENTS.includes(e.event));
  const mutationOk = mutations.some((m) => m.http_status >= 200 && m.http_status < 300);
  const mutationFail = mutations.some((m) => m.failed);
  const orphanParsed = events.some((e) => (
    e.event === 'tags.parsed'
    && ((Number(e.payload?.creates) || 0) > 0 || (Number(e.payload?.reschedules) || 0) > 0)
  )) && !hasOutcome;

  if (claimed && (hasCommit || mutationOk)) {
    return { verdict: 'PASS', invariant: 'I1', reason: 'afirmação com commit 2xx' };
  }
  if (claimed && !hasCommit && !mutationOk) {
    return { verdict: 'FAIL', invariant: 'I1', reason: 'sucesso no WhatsApp sem booking/mutation 2xx' };
  }
  if (orphanParsed || mutationFail) {
    return { verdict: 'FAIL', invariant: 'I1', reason: orphanParsed ? 'tag órfã' : 'agent_mutation HTTP>=400' };
  }
  if (!claimed) {
    return { verdict: 'PASS', invariant: 'I1', reason: 'sem afirmação de sucesso' };
  }
  return { verdict: 'CONCERNS', invariant: 'I1', reason: 'evidência incompleta' };
}

async function verifyCommit(db, { last4, assistantText = '', minutes = 30 } = {}) {
  const needle = normalizeLast4(last4);
  if (!needle) {
    return { error: 'last4_required', hint: 'Passe 4 dígitos finais do telefone.' };
  }
  const windowMin = clampMinutes(minutes, 30);
  let text = String(assistantText || '').trim();
  if (!text) {
    const thread = await getThread(db, { last4: needle, limit: 8 });
    const lastAssistant = [...(thread.turns || [])].reverse().find((t) => t.role === 'assistant');
    text = lastAssistant?.snippet || '';
  }
  const [events, mutations] = await Promise.all([
    listEvents(db, { minutes: windowMin, last4: needle }),
    listMutations(db, { minutes: windowMin }),
  ]);
  const verdict = classifyVerify({ assistantText: text, events, mutations });
  return {
    last4: needle,
    assistant_snippet: redactSnippet(text, 180),
    events,
    mutations: mutations.slice(0, 12),
    ...verdict,
  };
}

async function patrolLive(db, { minutes = 15, health = {} } = {}) {
  const windowMin = clampMinutes(minutes);
  const [events, stuck, orphans, mutations] = await Promise.all([
    listEvents(db, { minutes: windowMin }),
    listStuckThreads(db),
    listOrphans(db, { minutes: windowMin }),
    listMutations(db, { minutes: windowMin }),
  ]);
  const failedMutations = mutations.filter((m) => m.failed);
  return {
    window_min: windowMin,
    generated_at: new Date().toISOString(),
    health,
    events,
    stuck_threads: stuck,
    orphans,
    mutations,
    signals: {
      p0_stuck: stuck.length,
      p0_orphans: orphans.length,
      p0_mutation_fail: failedMutations.length,
      p0_leaks: events.filter((e) => e.event === 'tags.leaked' || e.event === 'tess.empty').length,
    },
    next_action: stuck.length || orphans.length || failedMutations.length
      ? 'activate-peer'
      : 'standby',
  };
}

module.exports = {
  OUTCOME_EVENTS,
  WATCH_EVENTS,
  SUCCESS_COPY_RE,
  last4FromPhone,
  normalizeLast4,
  redactSnippet,
  clampMinutes,
  listEvents,
  listStuckThreads,
  listOrphans,
  listMutations,
  getThread,
  verifyCommit,
  classifyVerify,
  patrolLive,
};
