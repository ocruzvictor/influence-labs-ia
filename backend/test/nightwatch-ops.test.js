const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OUTCOME_EVENTS,
  WATCH_EVENTS,
  last4FromPhone,
  normalizeLast4,
  normalizePhoneDigits,
  resolveLast4ToPhone,
  redactSnippet,
  classifyVerify,
  getThread,
  verifyCommit,
  patrolLive,
  listOrphans,
  listMutations,
  listEvents,
  listStuckThreads,
} = require('../lib/nightwatch-ops');

function windowCutoff(minutes) {
  return Date.now() - minutes * 60 * 1000;
}

function inWindow(ts, minutes) {
  return new Date(ts).getTime() >= windowCutoff(minutes);
}

function createSqlAwareDb({
  conversation = [],
  operationalEvents = [],
  mutations = [],
} = {}) {
  const calls = [];
  const db = {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });

      if (sql.includes('SELECT DISTINCT phone FROM')) {
        const last4 = params[0];
        const minutes = params[1];
        const phones = new Set();
        for (const row of conversation) {
          const phone = normalizePhoneDigits(row.client_phone);
          if (phone && last4FromPhone(phone) === last4 && inWindow(row.created_at, minutes)) {
            phones.add(phone);
          }
        }
        for (const row of operationalEvents) {
          const phone = normalizePhoneDigits(row.client_phone);
          if (phone && last4FromPhone(phone) === last4 && inWindow(row.received_at, minutes)) {
            phones.add(phone);
          }
        }
        for (const row of mutations) {
          const phone = normalizePhoneDigits(row.metadata?.client_phone);
          if (phone && last4FromPhone(phone) === last4 && inWindow(row.requested_at, minutes)) {
            phones.add(phone);
          }
        }
        return { rows: [...phones].map((phone) => ({ phone })) };
      }

      if (sql.includes('WITH parsed AS')) {
        assert.match(sql, /phone_norm/);
        assert.match(sql, /regexp_replace\(COALESCE\(e\.client_phone/);
        assert.ok(Array.isArray(params[1]));
        assert.ok(params[1].includes('booking.rescheduled'));

        const minutes = params[0];
        const outcomeEvents = params[1];
        const parsed = operationalEvents.filter((row) => (
          row.event === 'tags.parsed'
          && inWindow(row.received_at, minutes)
          && normalizePhoneDigits(row.client_phone)
          && ((Number(row.payload?.creates) || 0) > 0
            || (Number(row.payload?.reschedules) || 0) > 0)
        ));

        const orphans = parsed.filter((p) => {
          const phoneNorm = normalizePhoneDigits(p.client_phone);
          const pTime = new Date(p.received_at).getTime();
          const matched = operationalEvents.some((e) => (
            outcomeEvents.includes(e.event)
            && normalizePhoneDigits(e.client_phone) === phoneNorm
            && normalizePhoneDigits(e.client_phone)
            && Math.abs(new Date(e.received_at).getTime() - pTime) <= 2 * 60 * 1000
          ));
          return !matched;
        }).map((p) => ({
          last4: last4FromPhone(p.client_phone),
          received_at: p.received_at,
          creates: Number(p.payload?.creates) || 0,
          reschedules: Number(p.payload?.reschedules) || 0,
        }));

        return { rows: orphans };
      }

      if (sql.includes('FROM bot_operational_events') && sql.includes('event = ANY')) {
        const minutes = params[0];
        const scopedPhone = params[3];
        const rows = operationalEvents.filter((row) => {
          if (!inWindow(row.received_at, minutes)) return false;
          if (scopedPhone && normalizePhoneDigits(row.client_phone) !== scopedPhone) return false;
          return WATCH_EVENTS.includes(row.event);
        });
        return { rows };
      }

      if (sql.includes('FROM trinks_api_requests') && sql.includes('agent_mutation')) {
        const minutes = params[0];
        const scopedPhone = params[1];
        const rows = mutations.filter((row) => {
          if (!inWindow(row.requested_at, minutes)) return false;
          if (scopedPhone && row.metadata?.client_phone !== scopedPhone) return false;
          return String(row.origin || '').startsWith('agent_mutation_');
        });
        return { rows };
      }

      if (sql.includes('WITH last AS')) {
        const stuckMin = params[1];
        const cutoff = Date.now() - stuckMin * 60 * 1000;
        return {
          rows: conversation
            .filter((row) => row.role === 'user' && new Date(row.created_at).getTime() < cutoff)
            .map((row) => ({
              client_phone: row.client_phone,
              role: row.role,
              content: row.content,
              created_at: row.created_at,
            })),
        };
      }

      if (sql.includes('FROM conversation_history')) {
        const scopedPhone = params[0];
        const take = params[1];
        const minutes = params[2];
        let rows = conversation.filter((row) => normalizePhoneDigits(row.client_phone) === scopedPhone);
        if (minutes != null) {
          rows = rows.filter((row) => inWindow(row.created_at, minutes));
        }
        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { rows: rows.slice(0, take) };
      }

      return { rows: [] };
    },
  };
  return db;
}

function assertNoFullPhones(obj, allowedLast4 = []) {
  const json = JSON.stringify(obj);
  assert.ok(!json.match(/5511\d{8,9}/), 'full phone leaked in output');
  for (const last4 of allowedLast4) {
    assert.ok(json.includes(last4), `expected last4 ${last4} in output`);
  }
}

test('last4FromPhone and normalizeLast4 keep only 4 digits', () => {
  assert.equal(last4FromPhone('+55 11 97504-0517'), '0517');
  assert.equal(normalizeLast4('2513'), '2513');
  assert.equal(normalizeLast4('xx'), null);
});

test('WATCH_EVENTS includes tess.timeout but OUTCOME_EVENTS does not', () => {
  assert.ok(WATCH_EVENTS.includes('tess.timeout'));
  assert.ok(!OUTCOME_EVENTS.includes('tess.timeout'));
  assert.ok(OUTCOME_EVENTS.includes('booking.rescheduled'));
});

test('redactSnippet strips long digit runs', () => {
  assert.match(redactSnippet('liga 5511975040517 agora'), /\[digits\]/);
  assert.ok(!redactSnippet('liga 5511975040517 agora').includes('5511975040517'));
});

test('classifyVerify FAILs claimed success without commit', () => {
  const r = classifyVerify({
    assistantText: 'Confirmado, te vejo sábado!',
    events: [],
    mutations: [],
  });
  assert.equal(r.verdict, 'FAIL');
});

test('getThread rejects missing last4', async () => {
  const r = await getThread({ query: async () => ({ rows: [] }) }, { last4: '12' });
  assert.equal(r.error, 'last4_required');
});

test('getThread returns last4 only and redacts phones', async () => {
  const db = createSqlAwareDb({
    conversation: [{
      client_phone: '5511999990000',
      role: 'user',
      content: 'meu zap é 5511999990000',
      created_at: new Date().toISOString(),
    }],
  });
  const r = await getThread(db, { last4: '0000', clientPhone: '5511999990000' });
  assert.equal(r.last4, '0000');
  assert.equal(r.turns.length, 1);
  assert.ok(!r.turns[0].snippet.includes('5511999990000'));
});

test('listStuckThreads redacts full phones in public output', async () => {
  const db = createSqlAwareDb({
    conversation: [{
      client_phone: '5511975040517',
      role: 'user',
      content: 'preciso remarcar 5511975040517',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    }],
  });
  const stuck = await listStuckThreads(db, { lookbackHours: 12, stuckAfterMin: 3 });
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].last4, '0517');
  assertNoFullPhones(stuck);
});

test('patrolLive timeout-only: p0_timeout=1 and p0_leaks=0', async () => {
  const now = new Date().toISOString();
  const db = createSqlAwareDb({
    operationalEvents: [{
      event: 'tess.timeout',
      client_phone: '5511999990517',
      motivo: 'cancel stalled',
      payload: {},
      received_at: now,
    }],
  });
  const r = await patrolLive(db, { minutes: 15 });
  assert.equal(r.signals.p0_timeout, 1);
  assert.equal(r.signals.p0_leaks, 0);
  assert.equal(r.next_action, 'activate-peer');
});

test('patrolLive isolates timeout from leaks when both present', async () => {
  const now = new Date().toISOString();
  const db = createSqlAwareDb({
    operationalEvents: [
      {
        event: 'tess.timeout',
        client_phone: '5511999990517',
        motivo: 'cancel stalled',
        payload: {},
        received_at: now,
      },
      {
        event: 'tess.empty',
        client_phone: '5511888880517',
        motivo: null,
        payload: {},
        received_at: now,
      },
    ],
  });
  const r = await patrolLive(db, { minutes: 15 });
  assert.equal(r.signals.p0_timeout, 1);
  assert.equal(r.signals.p0_leaks, 1);
  assert.equal(r.next_action, 'activate-peer');
});

test('patrolLive stays global for mutation fail from any client', async () => {
  const db = createSqlAwareDb({
    mutations: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 500,
      requested_at: new Date().toISOString(),
      metadata: { client_phone: '5511999999999' },
    }],
  });
  const r = await patrolLive(db, { minutes: 15 });
  assert.equal(r.signals.p0_mutation_fail, 1);
  assert.equal(r.next_action, 'activate-peer');
});

test('resolveLast4ToPhone ignores old phone outside window', async () => {
  const db = createSqlAwareDb({
    conversation: [
      {
        client_phone: '5511111110517',
        role: 'user',
        content: 'old',
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      {
        client_phone: '5511222220517',
        role: 'user',
        content: 'recent',
        created_at: new Date().toISOString(),
      },
    ],
  });
  const r = await resolveLast4ToPhone(db, '0517', { minutes: 30 });
  assert.equal(r.ambiguous, false);
  assert.equal(r.phone, '5511222220517');
});

test('resolveLast4ToPhone is ambiguous when two phones share last4 in window', async () => {
  const now = new Date().toISOString();
  const db = createSqlAwareDb({
    conversation: [
      { client_phone: '5511111110517', role: 'user', content: 'a', created_at: now },
      { client_phone: '5511222220517', role: 'user', content: 'b', created_at: now },
    ],
  });
  const r = await resolveLast4ToPhone(db, '0517', { minutes: 30 });
  assert.equal(r.ambiguous, true);
  assert.equal(r.phone, null);
});

test('resolveLast4ToPhone passes minutes to SQL sources', async () => {
  const db = createSqlAwareDb();
  await resolveLast4ToPhone(db, '0517', { minutes: 45 });
  const resolveCall = db.calls.find((c) => c.sql.includes('SELECT DISTINCT phone FROM'));
  assert.equal(resolveCall.params[1], 45);
  assert.match(resolveCall.sql, /created_at >= NOW\(\) - \(\$2 \* INTERVAL '1 minute'\)/);
  assert.match(resolveCall.sql, /received_at >= NOW\(\) - \(\$2 \* INTERVAL '1 minute'\)/);
  assert.match(resolveCall.sql, /requested_at >= NOW\(\) - \(\$2 \* INTERVAL '1 minute'\)/);
});

test('verifyCommit ignores external assistantText and cross-client 2xx', async () => {
  const now = new Date().toISOString();
  const target = '5511999990517';
  const other = '5511888888888';
  const db = createSqlAwareDb({
    conversation: [
      {
        client_phone: target,
        role: 'assistant',
        content: 'Confirmado!',
        created_at: now,
        agent: 'tess',
      },
    ],
    mutations: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 201,
      requested_at: now,
      metadata: { client_phone: other },
    }],
  });
  const r = await verifyCommit(db, {
    last4: '0517',
    assistantText: 'Confirmado!',
    minutes: 30,
  });
  assert.equal(r.verdict, 'FAIL');
  assertNoFullPhones(r, ['0517']);
});

test('verifyCommit PASS with target 2xx and scoped assistant text', async () => {
  const now = new Date().toISOString();
  const target = '5511111110517';
  const db = createSqlAwareDb({
    conversation: [{
      client_phone: target,
      role: 'assistant',
      content: 'Confirmado!',
      created_at: now,
      agent: 'tess',
    }],
    mutations: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 201,
      requested_at: now,
      metadata: { client_phone: target },
    }],
  });
  const r = await verifyCommit(db, { last4: '0517', minutes: 30 });
  assert.equal(r.verdict, 'PASS');
});

test('verifyCommit ignores other-client mutation failure for target', async () => {
  const now = new Date().toISOString();
  const target = '5511999990517';
  const other = '5511888888888';
  const db = createSqlAwareDb({
    conversation: [{
      client_phone: target,
      role: 'assistant',
      content: 'Ok, sem promessa',
      created_at: now,
      agent: 'tess',
    }],
    mutations: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 500,
      requested_at: now,
      metadata: { client_phone: other },
    }],
  });
  const r = await verifyCommit(db, { last4: '0517', minutes: 30 });
  assert.equal(r.verdict, 'PASS');
});

test('verifyCommit ambiguous_last4 does not mix evidence', async () => {
  const now = new Date().toISOString();
  const db = createSqlAwareDb({
    conversation: [
      { client_phone: '5511111110517', role: 'user', content: 'a', created_at: now },
      { client_phone: '5511222220517', role: 'user', content: 'b', created_at: now },
    ],
  });
  const r = await verifyCommit(db, { last4: '0517', assistantText: 'Confirmado!', minutes: 30 });
  assert.equal(r.reason, 'ambiguous_last4');
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.mutations, []);
  assert.equal(r.assistant_snippet, null);
});

test('verifyCommit zero resolution ignores global mutation evidence', async () => {
  const db = createSqlAwareDb({
    mutations: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 201,
      requested_at: new Date().toISOString(),
      metadata: { client_phone: '5511999998888' },
    }],
  });
  const r = await verifyCommit(db, {
    last4: '7777',
    assistantText: 'Confirmado!',
    minutes: 30,
  });
  assert.equal(r.reason, 'last4_sem_cliente');
  assert.deepEqual(r.mutations, []);
});

test('verifyCommit getThread uses same minutes window', async () => {
  const db = createSqlAwareDb({
    conversation: [
      {
        client_phone: '5511999992513',
        role: 'assistant',
        content: 'Confirmado antigo',
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        agent: 'tess',
      },
      {
        client_phone: '5511999992513',
        role: 'assistant',
        content: 'Sem promessa recente',
        created_at: new Date().toISOString(),
        agent: 'tess',
      },
    ],
  });
  const r = await verifyCommit(db, { last4: '2513', minutes: 30 });
  assert.match(r.assistant_snippet || '', /Sem promessa recente/);
  const threadCall = db.calls.find((c) => c.sql.includes('FROM conversation_history')
    && c.params[2] === 30);
  assert.ok(threadCall);
});

test('listMutations global vs scoped metadata filter', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listMutations(db, { minutes: 15 });
  assert.equal(calls[0].params[1], null);
  await listMutations(db, { minutes: 15, clientPhone: '5511999990517' });
  assert.equal(calls[1].params[1], '5511999990517');
  assert.match(calls[1].sql, /regexp_replace\(COALESCE\(metadata->>'client_phone'/);
});

test('listOrphans keeps orphan when outcome belongs to different full phone same last4', async () => {
  const ts = new Date().toISOString();
  const db = createSqlAwareDb({
    operationalEvents: [
      {
        event: 'tags.parsed',
        client_phone: '5511111110517',
        payload: { creates: 1, reschedules: 0 },
        received_at: ts,
      },
      {
        event: 'booking.created',
        client_phone: '5511222220517',
        payload: {},
        received_at: ts,
      },
    ],
  });
  const orphans = await listOrphans(db, { minutes: 15 });
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0].last4, '0517');
});

test('listOrphans suppresses orphan for same-phone booking.created', async () => {
  const ts = new Date().toISOString();
  const db = createSqlAwareDb({
    operationalEvents: [
      {
        event: 'tags.parsed',
        client_phone: '5511111110517',
        payload: { creates: 1, reschedules: 0 },
        received_at: ts,
      },
      {
        event: 'booking.created',
        client_phone: '5511111110517',
        payload: {},
        received_at: ts,
      },
    ],
  });
  const orphans = await listOrphans(db, { minutes: 15 });
  assert.equal(orphans.length, 0);
});

test('listOrphans suppresses orphan for same-phone booking.rescheduled', async () => {
  const ts = new Date().toISOString();
  const db = createSqlAwareDb({
    operationalEvents: [
      {
        event: 'tags.parsed',
        client_phone: '5511111110517',
        payload: { creates: 0, reschedules: 1 },
        received_at: ts,
      },
      {
        event: 'booking.rescheduled',
        client_phone: '5511111110517',
        payload: {},
        received_at: ts,
      },
    ],
  });
  const orphans = await listOrphans(db, { minutes: 15 });
  assert.equal(orphans.length, 0);
});

test('listEvents scopes by clientPhone internally', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listEvents(db, { minutes: 15, clientPhone: '5511999990517' });
  assert.equal(calls[0].params[3], '5511999990517');
  assert.equal(calls[0].params[2], null);
});
