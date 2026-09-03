/**
 * Operações read-only das CLIs salao/ — não mutam Nightwatch live nem Trinks.
 */

const {
  last4FromPhone,
  normalizeLast4,
  redactSnippet,
  resolveLast4ToPhone,
  getThread,
  listEvents,
  listMutations,
} = require('./nightwatch-ops');

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

async function correlacionarLast4(db, { last4, minutos = 30 } = {}) {
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
  return {
    window_min: windowMin,
    total,
    counts,
    rates,
    sample: (sample?.rows || []).map((row) => ({
      event: row.event,
      last4: last4OnlyPhone(row.client_phone),
      motivo: redactSnippet(row.motivo, 80),
    })),
  };
}

module.exports = {
  listStuckThreadsFiltered,
  listAckWithoutOutbound,
  checarFrescuraSnapshot,
  correlacionarLast4,
  relatarSloEventos,
};
