const test = require('node:test');
const assert = require('node:assert/strict');
const {
  last4FromPhone,
  normalizeLast4,
  redactSnippet,
  classifyVerify,
  getThread,
  verifyCommit,
  patrolLive,
} = require('../lib/nightwatch-ops');

function fakeDb(rowsByNeedle) {
  return {
    query: async (sql) => {
      for (const [needle, rows] of Object.entries(rowsByNeedle)) {
        if (sql.includes(needle)) return { rows };
      }
      return { rows: [] };
    },
  };
}

test('last4FromPhone and normalizeLast4 keep only 4 digits', () => {
  assert.equal(last4FromPhone('+55 11 97504-0517'), '0517');
  assert.equal(normalizeLast4('2513'), '2513');
  assert.equal(normalizeLast4('xx'), null);
});

test('redactSnippet strips long digit runs', () => {
  assert.match(redactSnippet('liga 5511975040517 agora'), /\[digits\]/);
  assert.ok(!redactSnippet('liga 5511975040517 agora').includes('5511975040517'));
});

test('redactSnippet strips punctuated phone numbers', () => {
  const redacted = redactSnippet('liga +55 (11) 97504-0517 agora');
  assert.match(redacted, /\[digits\]/);
  assert.ok(!redacted.includes('97504-0517'));
});

test('classifyVerify FAILs claimed success without commit', () => {
  const r = classifyVerify({
    assistantText: 'Confirmado, te vejo sábado!',
    events: [],
    mutations: [],
  });
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.invariant, 'I1');
});

test('classifyVerify PASS when created event exists', () => {
  const r = classifyVerify({
    assistantText: 'Agendado! Sábado 13h.',
    events: [{ event: 'booking.created', payload: {} }],
    mutations: [],
  });
  assert.equal(r.verdict, 'PASS');
});

test('classifyVerify FAIL on orphan tags.parsed', () => {
  const r = classifyVerify({
    assistantText: 'Deixa eu olhar a agenda',
    events: [{ event: 'tags.parsed', payload: { creates: 1, reschedules: 0 } }],
    mutations: [],
  });
  assert.equal(r.verdict, 'FAIL');
  assert.match(r.reason, /órfã/);
});

test('getThread rejects missing last4', async () => {
  const r = await getThread({ query: async () => ({ rows: [] }) }, { last4: '12' });
  assert.equal(r.error, 'last4_required');
});

test('getThread returns last4 only and redacts phones', async () => {
  const db = fakeDb({
    conversation_history: [{
      role: 'user',
      content: 'meu zap é 5511999990000',
      created_at: '2026-09-02T12:00:00Z',
      agent: null,
    }],
  });
  const r = await getThread(db, { last4: '0000' });
  assert.equal(r.last4, '0000');
  assert.equal(r.turns.length, 1);
  assert.ok(!r.turns[0].snippet.includes('5511999990000'));
});

test('verifyCommit uses last assistant when text omitted', async () => {
  const db = fakeDb({
    conversation_history: [{
      role: 'assistant',
      content: 'Confirmado!',
      created_at: '2026-09-02T12:00:00Z',
      agent: 'tess',
    }],
    bot_operational_events: [],
    trinks_api_requests: [],
  });
  const r = await verifyCommit(db, { last4: '2513' });
  assert.equal(r.last4, '2513');
  assert.equal(r.verdict, 'FAIL');
});

test('patrolLive aggregates signals without exposing full phones', async () => {
  const db = fakeDb({
    'FROM bot_operational_events': [{
      event: 'tags.leaked',
      client_phone: '5511975040517',
      motivo: null,
      payload: { tagNames: ['[BOOKING_CREATE]'] },
      received_at: '2026-09-02T12:00:00Z',
    }],
    conversation_history: [{
      client_phone: '5511975040517',
      role: 'user',
      content: 'oi',
      created_at: '2026-09-02T11:00:00Z',
    }],
    'FROM parsed': [],
    trinks_api_requests: [{
      method: 'POST',
      endpoint: '/agendamentos',
      origin: 'agent_mutation_create',
      http_status: 500,
      requested_at: '2026-09-02T12:01:00Z',
    }],
  });
  const r = await patrolLive(db, { minutes: 15, health: { mode: 'OPEN' } });
  assert.equal(r.health.mode, 'OPEN');
  assert.equal(r.events[0].last4, '0517');
  assert.equal(r.signals.p0_mutation_fail, 1);
  assert.equal(r.next_action, 'activate-peer');
  assert.ok(!JSON.stringify(r).includes('5511975040517'));
});
