/**
 * Operações read-only das CLIs salao/ — não mutam Nightwatch live nem Trinks.
 */

const {
  last4FromPhone,
  normalizeLast4,
  redactSnippet,
  resolveLast4ToPhone,
  resolveTraceId,
  getThread,
  listEvents,
  listMutations,
} = require('./nightwatch-ops');

const BR_PHONE_RE = /(?<!\d)(?:\+?55[\s().-]*\d[\s().-]*){10,}(?!\d)/g;
const LONG_DIGIT_RUN_RE = /(?<!\d)(?:\+?\d[\s().-]*){12,}(?!\d)/g;

function normalizeCorpusText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function redactCorpusText(text) {
  return String(text || '')
    .replace(BR_PHONE_RE, '[phone]')
    .replace(LONG_DIGIT_RUN_RE, '[phone]');
}

function sanitizeCorpusRow(row) {
  const last4 = row.last4 ? String(row.last4).slice(-4) : null;
  const safeLast4 = last4 && /^\d{4}$/.test(last4) ? last4 : null;
  return {
    last4: safeLast4,
    role: row.role || null,
    agent: row.agent || null,
    intent: row.intent ?? null,
    text: redactCorpusText(row.text),
    created_at: row.created_at,
  };
}

function computeCorpusStats(rows) {
  const threads = new Set();
  const tessReplied = new Set();
  const inboundOnly = new Set();
  const userThreads = new Set();
  let intentNullCount = 0;

  for (const row of rows) {
    const last4 = row.last4;
    if (!last4) continue;
    threads.add(last4);
    if (row.intent == null) intentNullCount += 1;
    if (row.role === 'user') userThreads.add(last4);
    if (row.role === 'assistant' && String(row.agent || '') !== 'passive') {
      tessReplied.add(last4);
    }
  }

  for (const last4 of userThreads) {
    if (!tessReplied.has(last4)) inboundOnly.add(last4);
  }

  return {
    threads_last4: threads.size,
    unique_utterances: rows.length,
    tess_replied: tessReplied.size,
    inbound_only: inboundOnly.size,
    intent_null_count: intentNullCount,
  };
}

function dedupCorpusRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.last4 || ''}\0${normalizeCorpusText(row.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function last4OnlyPhone(phone) {
  return last4FromPhone(phone);
}

async function listStuckThreadsFiltered(db, {
  lookbackHours = 12,
  stuckAfterMin = 3,
  filtrarSilence = true,
  sampleLimit = 20,
} = {}) {
  const hours = Math.min(48, Math.max(1, Number(lookbackHours) || 12));
  const stuckMin = Math.min(30, Math.max(3, Number(stuckAfterMin) || 3));
  const take = Math.min(200, Math.max(1, Number(sampleLimit) || 20));
  const result = await db.query(
    `WITH last AS (
       SELECT DISTINCT ON (regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'))
              client_phone, role, content, created_at
         FROM conversation_history
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 hour')
          AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
        ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), created_at DESC
     )
     SELECT l.client_phone, l.role, l.content, l.created_at,
            w.mode AS whitelist_mode,
            t.silenced_until
       FROM last l
       LEFT JOIN bot_whitelist w
         ON regexp_replace(COALESCE(w.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
       LEFT JOIN bot_thread_state t
         ON regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
      WHERE l.role = 'user'
        AND l.created_at < NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY l.created_at ASC`,
    [hours, stuckMin],
  );
  const now = Date.now();
  const rows = (result?.rows || []).map((row) => {
    const silencedUntil = row.silenced_until ? new Date(row.silenced_until).getTime() : 0;
    const mode = String(row.whitelist_mode || '').toLowerCase();
    let filtered_reason = null;
    if (mode === 'block' || mode === 'human_only') filtered_reason = mode;
    else if (silencedUntil > now) filtered_reason = 'silenced_until';
    return {
      last4: last4OnlyPhone(row.client_phone),
      waiting_min: Math.round((now - new Date(row.created_at).getTime()) / 60000),
      created_at: row.created_at,
      snippet: redactSnippet(row.content),
      whitelist_mode: row.whitelist_mode || null,
      filtered_reason,
    };
  });
  const visible = filtrarSilence ? rows.filter((r) => !r.filtered_reason) : rows;
  return {
    lookback_hours: hours,
    stuck_after_min: stuckMin,
    filtrar_silence: Boolean(filtrarSilence),
    total_raw: rows.length,
    total_visible: visible.length,
    sample_limit: take,
    saturated: rows.length >= take,
    threads: visible.slice(0, take),
  };
}

async function listAckWithoutOutbound(db, { minutos = 60, segundos = 45 } = {}) {
  const windowMin = Math.min(180, Math.max(5, Number(minutos) || 60));
  const waitSec = Math.min(3600, Math.max(5, Number(segundos) || 45));
  const result = await db.query(
    `WITH last AS (
       SELECT DISTINCT ON (regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'))
              client_phone, role, content, created_at, agent
         FROM conversation_history
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 minute')
          AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
        ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), created_at DESC
     )
     SELECT client_phone, role, content, created_at, agent
       FROM last
      WHERE role = 'user'
        AND created_at < NOW() - ($2 * INTERVAL '1 second')
      ORDER BY created_at ASC
      LIMIT 50`,
    [windowMin, waitSec],
  );
  return {
    window_min: windowMin,
    wait_sec: waitSec,
    silences: (result?.rows || []).map((row) => ({
      last4: last4OnlyPhone(row.client_phone),
      waiting_sec: Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000),
      created_at: row.created_at,
      snippet: redactSnippet(row.content),
    })),
  };
}

async function checarFrescuraSnapshot(db, { maxIdadeHoras = 24, data = null } = {}) {
  const maxAge = Math.min(168, Math.max(1, Number(maxIdadeHoras) || 24));
  const kinds = await db.query(
    `SELECT 'professionals' AS kind, MAX(synced_at) AS synced_at, COUNT(*)::int AS n FROM trinks_professionals
     UNION ALL
     SELECT 'services', MAX(synced_at), COUNT(*)::int FROM trinks_services
     UNION ALL
     SELECT 'slots', MAX(synced_at), COUNT(*)::int FROM trinks_slots
     UNION ALL
     SELECT 'clients', MAX(synced_at), COUNT(*)::int FROM trinks_clients
     UNION ALL
     SELECT 'slot_runs', MAX(synced_at), COUNT(*)::int FROM trinks_slot_snapshot_runs`,
  );
  const now = Date.now();
  const maxAgeMs = maxAge * 3600 * 1000;
  const parts = (kinds?.rows || []).map((row) => {
    const synced = row.synced_at ? new Date(row.synced_at).getTime() : 0;
    const ageHours = synced ? (now - synced) / 3600000 : null;
    return {
      kind: row.kind,
      n: Number(row.n) || 0,
      synced_at: row.synced_at || null,
      age_hours: ageHours == null ? null : Number(ageHours.toFixed(2)),
      stale: !synced || (now - synced) > maxAgeMs,
    };
  });
  let dateCovered = null;
  if (data) {
    const cover = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM trinks_slot_snapshot_runs
          WHERE snapshot_date = $1::DATE
            AND synced_at >= NOW() - ($2::TEXT || ' hours')::INTERVAL
       ) AS covered`,
      [data, String(maxAge)],
    );
    dateCovered = cover?.rows?.[0]?.covered === true;
  }
  return {
    max_idade_horas: maxAge,
    data: data || null,
    date_covered: dateCovered,
    stale: parts.some((p) => p.stale) || (data != null && dateCovered === false),
    parts,
  };
}

async function correlacionarLast4(db, { last4, minutos = 30, traceId = null } = {}) {
  if (traceId) {
    const byTrace = await resolveTraceId(db, traceId);
    if (byTrace.ambiguous) {
      return {
        last4: last4FromPhone(byTrace.phones[0]),
        trace_id: byTrace.trace_id,
        ambiguous_last4: true,
        window_min: null,
        thread: null,
        events: [],
        mutations: [],
      };
    }
    if (!byTrace.phone) {
      return {
        last4: null,
        trace_id: byTrace.trace_id,
        ambiguous_last4: false,
        window_min: null,
        thread: null,
        events: [],
        mutations: [],
      };
    }
    const [thread, events, mutations] = await Promise.all([
      getThread(db, {
        last4: last4FromPhone(byTrace.phone),
        clientPhone: byTrace.phone,
        limit: 16,
        minutes: 180,
      }),
      listEvents(db, { minutes: 180, clientPhone: byTrace.phone }),
      listMutations(db, { minutes: 180, clientPhone: byTrace.phone }),
    ]);
    return {
      last4: last4FromPhone(byTrace.phone),
      trace_id: byTrace.trace_id,
      ambiguous_last4: false,
      window_min: 180,
      thread,
      events,
      mutations,
    };
  }
  const needle = normalizeLast4(last4);
  if (!needle) return { error: 'last4_required' };
  const windowMin = Math.min(180, Math.max(5, Number(minutos) || 30));
  const resolution = await resolveLast4ToPhone(db, needle, { minutes: windowMin });
  if (resolution.ambiguous) {
    return {
      last4: needle,
      ambiguous_last4: true,
      thread: null,
      events: [],
      mutations: [],
    };
  }
  const clientPhone = resolution.phone;
  if (!clientPhone) {
    return {
      last4: needle,
      ambiguous_last4: false,
      thread: null,
      events: [],
      mutations: [],
    };
  }
  const [thread, events, mutations] = await Promise.all([
    getThread(db, { last4: needle, clientPhone, limit: 16, minutes: windowMin }),
    listEvents(db, { minutes: windowMin, clientPhone }),
    listMutations(db, { minutes: windowMin, clientPhone }),
  ]);
  return {
    last4: needle,
    ambiguous_last4: false,
    window_min: windowMin,
    thread,
    events,
    mutations,
  };
}

async function relatarSloEventos(db, { minutos = 60, horas = null } = {}) {
  const windowMin = horas != null
    ? Math.min(2880, Math.max(15, Number(horas) * 60 || 60))
    : Math.min(2880, Math.max(15, Number(minutos) || 60));
  const grouped = await db.query(
    `SELECT event, COUNT(*)::int AS n
       FROM bot_operational_events
      WHERE received_at >= NOW() - ($1 * INTERVAL '1 minute')
      GROUP BY event
      ORDER BY n DESC`,
    [windowMin],
  );
  const counts = {};
  let total = 0;
  for (const row of grouped?.rows || []) {
    counts[row.event] = Number(row.n) || 0;
    total += Number(row.n) || 0;
  }
  const rates = {};
  for (const [event, n] of Object.entries(counts)) {
    rates[event] = total ? Number((n / total).toFixed(3)) : 0;
  }
  const sample = await db.query(
    `SELECT event, client_phone, motivo
       FROM bot_operational_events
      WHERE received_at >= NOW() - ($1 * INTERVAL '1 minute')
        AND event IN (
          'tess.timeout','booking.failed','cancel.not_owned',
          'handoff.human','outbound.watchdog','handoff.sla_breach'
        )
      ORDER BY received_at DESC
      LIMIT 12`,
    [windowMin],
  );
  const hours = Math.max(windowMin / 60, 1 / 60);
  const burnEvents = [
    'tess.timeout',
    'booking.failed',
    'cancel.not_owned',
    'handoff.human',
    'tess.empty',
    'guard.blocked',
    'handoff.sla_breach',
    'outbound.watchdog',
    'snapshot.stale',
  ];
  const perHour = {};
  for (const event of burnEvents) {
    const n = counts[event] || 0;
    perHour[event] = Number((n / hours).toFixed(2));
  }
  return {
    window_min: windowMin,
    total,
    counts,
    rates,
    per_hour: perHour,
    sample: (sample?.rows || []).map((row) => ({
      event: row.event,
      last4: last4OnlyPhone(row.client_phone),
      motivo: redactSnippet(row.motivo, 80),
    })),
  };
}

async function listarFilaAtendimento(db, { horas = 12, sampleLimit = 30 } = {}) {
  const hours = Math.min(72, Math.max(1, Number(horas) || 12));
  const take = Math.min(80, Math.max(1, Number(sampleLimit) || 30));
  const result = await db.query(
    `WITH last AS (
       SELECT DISTINCT ON (regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'))
              client_phone, role, content, intent, trace_id, created_at, agent
         FROM conversation_history
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 hour')
          AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
        ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), created_at DESC
     ),
     last_user AS (
       SELECT DISTINCT ON (regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'))
              client_phone, content, intent, created_at
         FROM conversation_history
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 hour')
          AND role = 'user'
          AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
        ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), created_at DESC
     ),
     last_event AS (
       SELECT DISTINCT ON (regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'))
              client_phone, event, motivo, payload, received_at
         FROM bot_operational_events
        WHERE received_at >= NOW() - ($1 * INTERVAL '1 hour')
          AND event IN (
            'handoff.human','handoff.accepted','handoff.sla_breach',
            'booking.failed','booking.created','tess.timeout','tess.empty',
            'guard.blocked','tess.turn','snapshot.stale'
          )
        ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), received_at DESC
     )
     SELECT l.client_phone, l.role, l.content, l.intent, l.trace_id, l.created_at, l.agent,
            u.content AS last_user_content, u.intent AS last_user_intent, u.created_at AS last_user_at,
            w.mode AS whitelist_mode,
            t.silenced_until, t.silence_reason, t.last_handoff_at, t.last_handoff_motivo,
            e.event AS last_event, e.motivo AS last_event_motivo, e.payload AS last_event_payload
       FROM last l
       LEFT JOIN last_user u
         ON regexp_replace(COALESCE(u.client_phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
       LEFT JOIN bot_whitelist w
         ON regexp_replace(COALESCE(w.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
       LEFT JOIN bot_thread_state t
         ON regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
       LEFT JOIN last_event e
         ON regexp_replace(COALESCE(e.client_phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(l.client_phone, ''), '[^0-9]', '', 'g')
      ORDER BY COALESCE(u.created_at, l.created_at) ASC`,
    [hours],
  );
  const now = Date.now();
  const threads = (result?.rows || []).map((row) => {
    const silencedUntil = row.silenced_until ? new Date(row.silenced_until).getTime() : 0;
    const payload = row.last_event_payload && typeof row.last_event_payload === 'object'
      ? row.last_event_payload
      : {};
    return {
      last4: last4OnlyPhone(row.client_phone),
      last_role: row.role,
      last_intent: row.last_user_intent || row.intent || null,
      waiting_min: row.last_user_at
        ? Math.round((now - new Date(row.last_user_at).getTime()) / 60000)
        : null,
      snippet: redactSnippet(row.last_user_content || row.content),
      whitelist_mode: row.whitelist_mode || null,
      silenced: silencedUntil > now,
      silence_reason: row.silence_reason || null,
      handoff_at: row.last_handoff_at || null,
      handoff_motivo: row.last_handoff_motivo || null,
      last_event: row.last_event || null,
      last_event_motivo: redactSnippet(row.last_event_motivo, 80),
      context_profile: payload.context_profile || null,
      tess_credits: payload.tess_credits ?? null,
      trace_id: row.trace_id || payload.trace_id || null,
    };
  });
  return {
    horas: hours,
    total: threads.length,
    sample_limit: take,
    threads: threads.slice(0, take),
  };
}

async function dumpFloorCorpus(db, { fromIso, toIso, dedup = true } = {}) {
  if (!fromIso || !toIso) {
    return { error: 'window_required', fromIso: fromIso || null, toIso: toIso || null };
  }

  const [historyResult, staffResult] = await Promise.all([
    db.query(
      `SELECT
         RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) AS last4,
         role,
         agent,
         intent,
         content AS text,
         created_at
       FROM conversation_history
      WHERE created_at >= $1::timestamp
        AND created_at < $2::timestamp
        AND regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') <> ''
      ORDER BY regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), created_at`,
      [fromIso, toIso],
    ),
    db.query(
      `SELECT COUNT(*)::int AS n
         FROM bot_thread_state
        WHERE last_staff_outbound_at >= $1::timestamp
          AND last_staff_outbound_at < $2::timestamp`,
      [fromIso, toIso],
    ),
  ]);

  const rawRows = (historyResult?.rows || []).map(sanitizeCorpusRow);
  const statsFromRaw = computeCorpusStats(rawRows);
  const utterances = dedup ? dedupCorpusRows(rawRows) : rawRows;
  const stats = {
    ...statsFromRaw,
    unique_utterances: utterances.length,
    staff_outbound_in_window: Number(staffResult?.rows?.[0]?.n) || 0,
  };

  return {
    window: { from: fromIso, to: toIso },
    dedup: Boolean(dedup),
    stats,
    utterances,
  };
}

module.exports = {
  listStuckThreadsFiltered,
  listAckWithoutOutbound,
  checarFrescuraSnapshot,
  correlacionarLast4,
  relatarSloEventos,
  listarFilaAtendimento,
  dumpFloorCorpus,
  normalizeCorpusText,
  redactCorpusText,
};
