/**
 * Nightwatch read-only ops — last4 only, no raw SQL surface, no Trinks mutate.
 */

const OUTCOME_EVENTS = [
  'booking.created',
  'booking.failed',
  'booking.dropped',
  'booking.cancelled',
  'booking.rescheduled',
  'guard.blocked',
];

const WATCH_EVENTS = [
  ...OUTCOME_EVENTS,
  'tags.parsed',
  'tags.leaked',
  'handoff.human',
  'handoff.accepted',
  'handoff.sla_breach',
  'tess.empty',
  'tess.timeout',
  'cancel.not_owned',
  'outbound.watchdog',
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

function normalizePhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

const RESOLVE_LAST4_SQL = `
  SELECT DISTINCT phone FROM (
    SELECT regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') AS phone
      FROM conversation_history
     WHERE RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $1
       AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
       AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
    UNION
    SELECT regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') AS phone
      FROM bot_operational_events
     WHERE RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $1
       AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
       AND received_at >= NOW() - ($2 * INTERVAL '1 minute')
    UNION
    SELECT regexp_replace(COALESCE(metadata->>'client_phone', ''), '[^0-9]', '', 'g') AS phone
      FROM trinks_api_requests
     WHERE origin LIKE 'agent_mutation_%'
       AND metadata->>'client_phone' IS NOT NULL
       AND regexp_replace(COALESCE(metadata->>'client_phone', ''), '[^0-9]', '', 'g') <> ''
       AND RIGHT(regexp_replace(COALESCE(metadata->>'client_phone', ''), '[^0-9]', '', 'g'), 4) = $1
       AND requested_at >= NOW() - ($2 * INTERVAL '1 minute')
  ) src
 WHERE phone IS NOT NULL AND phone <> ''`;

async function resolveLast4ToPhone(db, last4, { minutes = 30 } = {}) {
  const needle = normalizeLast4(last4);
  if (!needle) return { phone: null, ambiguous: false, phones: [] };
  const windowMin = clampMinutes(minutes, 30);
  const result = await db.query(RESOLVE_LAST4_SQL, [needle, windowMin]);
  const phones = [...new Set((result?.rows || [])
    .map((row) => normalizePhoneDigits(row.phone))
    .filter(Boolean))];
  if (phones.length > 1) return { phone: null, ambiguous: true, phones };
  if (phones.length === 1) return { phone: phones[0], ambiguous: false, phones };
  return { phone: null, ambiguous: false, phones: [] };
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

async function listEvents(db, { minutes = 15, last4 = null, clientPhone = null } = {}) {
  const windowMin = clampMinutes(minutes);
  const needle = last4 ? normalizeLast4(last4) : null;
  const scopedPhone = clientPhone ? normalizePhoneDigits(clientPhone) : null;
  const result = await db.query(
    `SELECT event, client_phone, motivo, payload, received_at
       FROM bot_operational_events
      WHERE received_at >= NOW() - ($1 * INTERVAL '1 minute')
        AND event = ANY($2::text[])
        AND ($4::text IS NULL
             OR regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = $4)
        AND ($3::text IS NULL
             OR RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $3)
      ORDER BY received_at DESC
      LIMIT 80`,
    [windowMin, WATCH_EVENTS, scopedPhone ? null : needle, scopedPhone],
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
              regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') AS phone_norm,
              RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) AS last4,
              COALESCE((payload->>'creates')::int, 0) AS creates,
              COALESCE((payload->>'reschedules')::int, 0) AS reschedules
         FROM bot_operational_events
        WHERE event = 'tags.parsed'
          AND received_at >= NOW() - ($1 * INTERVAL '1 minute')
          AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
          AND (
            COALESCE((payload->>'creates')::int, 0) > 0
            OR COALESCE((payload->>'reschedules')::int, 0) > 0
          )
     )
     SELECT p.last4, p.received_at, p.creates, p.reschedules
       FROM parsed p
      WHERE p.last4 IS NOT NULL
        AND char_length(p.last4) = 4
        AND p.phone_norm <> ''
        AND NOT EXISTS (
          SELECT 1
            FROM bot_operational_events e
           WHERE e.event = ANY($2::text[])
             AND regexp_replace(COALESCE(e.client_phone, ''), '[^0-9]', '', 'g') = p.phone_norm
             AND regexp_replace(COALESCE(e.client_phone, ''), '[^0-9]', '', 'g') <> ''
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
    hint: 'tags.parsed sem outcome ±2min (telefone completo)',
  }));
}

async function listMutations(db, { minutes = 15, clientPhone = null } = {}) {
  const windowMin = clampMinutes(minutes);
  const scopedPhone = clientPhone ? normalizePhoneDigits(clientPhone) : null;
  const result = await db.query(
    `SELECT method, endpoint, origin, http_status, requested_at
       FROM trinks_api_requests
      WHERE requested_at >= NOW() - ($1 * INTERVAL '1 minute')
        AND origin LIKE 'agent_mutation_%'
        AND ($2::text IS NULL
             OR regexp_replace(COALESCE(metadata->>'client_phone', ''), '[^0-9]', '', 'g') = $2)
      ORDER BY requested_at DESC
      LIMIT 40`,
    [windowMin, scopedPhone],
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

async function getThread(db, { last4, limit = 12, clientPhone = null, minutes = null } = {}) {
  const needle = normalizeLast4(last4);
  if (!needle) {
    return { error: 'last4_required', hint: 'Passe 4 dígitos finais do telefone.' };
  }
  const scopedPhone = clientPhone ? normalizePhoneDigits(clientPhone) : null;
  const take = clampLimit(limit);
  const windowMin = minutes == null ? null : clampMinutes(minutes);
  let sql;
  let params;
  if (scopedPhone) {
    if (windowMin != null) {
      sql = `SELECT role, content, created_at, agent
               FROM conversation_history
              WHERE regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = $1
                AND created_at >= NOW() - ($3 * INTERVAL '1 minute')
              ORDER BY created_at DESC
              LIMIT $2`;
      params = [scopedPhone, take, windowMin];
    } else {
      sql = `SELECT role, content, created_at, agent
               FROM conversation_history
              WHERE regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = $1
              ORDER BY created_at DESC
              LIMIT $2`;
      params = [scopedPhone, take];
    }
  } else {
    sql = `SELECT role, content, created_at, agent
             FROM conversation_history
            WHERE RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $1
            ORDER BY created_at DESC
            LIMIT $2`;
    params = [needle, take];
  }
  const result = await db.query(sql, params);
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
  const resolution = await resolveLast4ToPhone(db, needle, { minutes: windowMin });
  if (resolution.ambiguous) {
    return {
      last4: needle,
      verdict: 'CONCERNS',
      invariant: 'I1',
      reason: 'ambiguous_last4',
      ambiguous_last4: true,
      assistant_snippet: null,
      events: [],
      mutations: [],
    };
  }

  const clientPhone = resolution.phone;
  let text = '';
  if (clientPhone) {
    const thread = await getThread(db, {
      last4: needle,
      clientPhone,
      limit: 8,
      minutes: windowMin,
    });
    const lastAssistant = [...(thread.turns || [])].reverse().find((t) => t.role === 'assistant');
    text = lastAssistant?.snippet || '';
  }

  let events = [];
  let mutations = [];
  if (clientPhone) {
    [events, mutations] = await Promise.all([
      listEvents(db, { minutes: windowMin, clientPhone }),
      listMutations(db, { minutes: windowMin, clientPhone }),
    ]);
  }

  const verdict = clientPhone
    ? classifyVerify({ assistantText: text, events, mutations })
    : { verdict: 'CONCERNS', invariant: 'I1', reason: 'last4_sem_cliente' };

  return {
    last4: needle,
    assistant_snippet: redactSnippet(text, 180) || null,
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
  const p0Timeout = events.filter((e) => e.event === 'tess.timeout').length;
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
      p0_timeout: p0Timeout,
    },
    next_action: stuck.length || orphans.length || failedMutations.length || p0Timeout
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
  normalizePhoneDigits,
  resolveLast4ToPhone,
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
