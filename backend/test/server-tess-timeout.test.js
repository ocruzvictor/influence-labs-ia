/**
 * Integration-style unit test — processMessage timeout boundary (Story 12 + chão 6).
 * Uses only local stubs; no TESS, Trinks or Kapso network calls.
 */

const { test, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');
const { DEFAULT_TIMEOUT_COPY, CANCEL_TIMEOUT_COPY } = require('../lib/tess-timeout');
const { DEFAULT_ABORT_MS, TESS_TIMEOUT_WALL_MS } = require('../lib/tess-timeout-budget');

const originalDbQuery = db.query;
const originalFetch = global.fetch;
const originalAbortTimeout = AbortSignal.timeout;
const originalEnv = {
  TESS_CONTEXT_MODE: process.env.TESS_CONTEXT_MODE,
  TESS_CONTEXT_FORCE_FULL: process.env.TESS_CONTEXT_FORCE_FULL,
  TESS_WORKSPACE_ID: process.env.TESS_WORKSPACE_ID,
  TESS_API_TOKEN: process.env.TESS_API_TOKEN,
};

const queries = [];
const fetchCalls = [];
const operationalEvents = [];
const abortTimeouts = [];

process.env.TESS_CONTEXT_MODE = 'scoped';
process.env.TESS_CONTEXT_FORCE_FULL = '0';
process.env.TESS_WORKSPACE_ID = '1458234';
process.env.TESS_API_TOKEN = 'test-token';

function resetHarness() {
  queries.length = 0;
  fetchCalls.length = 0;
  operationalEvents.length = 0;
  abortTimeouts.length = 0;
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    throw error;
  };
}

function loadServerFresh(envOverrides = {}) {
  for (const [key, value] of Object.entries({
    TESS_CONTEXT_MODE: 'scoped',
    TESS_CONTEXT_FORCE_FULL: '0',
    TESS_WORKSPACE_ID: '1458234',
    TESS_API_TOKEN: 'test-token',
    ...envOverrides,
  })) {
    process.env[key] = value;
  }
  const serverPath = require.resolve('../server');
  delete require.cache[serverPath];
  return require('../server');
}

db.query = async (sql, params = []) => {
  const text = String(sql);
  queries.push({ text, params });
  if (text.includes('bot_operational_events')) {
    operationalEvents.push({
      event: params[0],
      clientPhone: params[1],
      payload: JSON.parse(params[4] || '{}'),
    });
  }
  if (text.includes('FROM conversation_history') || text.includes('conversation_history')) {
    return { rows: [] };
  }
  if (text.includes('FROM bot_thread_state')) {
    return { rows: [] };
  }
  if (text.includes('FROM trinks_clients')) {
    return { rows: [] };
  }
  return { rows: [] };
};

global.fetch = async (...args) => {
  fetchCalls.push(args);
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  throw error;
};

AbortSignal.timeout = (ms) => {
  abortTimeouts.push(ms);
  return originalAbortTimeout(Math.min(ms, 50));
};

const { processMessage, callTESS, runOperatorResumeTurn } = loadServerFresh();

beforeEach(() => {
  resetHarness();
});

after(() => {
  db.query = originalDbQuery;
  global.fetch = originalFetch;
  AbortSignal.timeout = originalAbortTimeout;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function assertZeroMutation() {
  const mutating = queries.filter((entry) => {
    const text = String(entry.text);
    return /^\s*(INSERT|UPDATE|DELETE|PATCH)\b/i.test(text)
      && !/INSERT INTO bot_operational_events/i.test(text)
      && !/INSERT INTO conversation_history/i.test(text);
  });
  const sql = mutating.map((entry) => entry.text).join('\n');
  assert.doesNotMatch(sql, /UPDATE bot_thread_state/i);
  assert.doesNotMatch(sql, /INSERT INTO trinks_api_requests/i);
  assert.doesNotMatch(sql, /booking\.cancelled/i);
  assert.doesNotMatch(sql, /tags\.parsed/i);
}

function assertTimeoutEvent(expected) {
  const timeoutEvents = operationalEvents.filter((e) => e.event === 'tess.timeout');
  assert.equal(timeoutEvents.length, 1, 'expected one tess.timeout event');
  assert.equal(timeoutEvents[0].clientPhone, expected.clientPhone);
  assert.deepEqual(timeoutEvents[0].payload, {
    intent: expected.intent,
    contextProfile: expected.contextProfile,
    timeout_ms: expected.timeout_ms,
  });
  assert.ok(expected.timeout_ms < TESS_TIMEOUT_WALL_MS);
}

function assertTimedOutTurn(expected) {
  const turnEvents = operationalEvents.filter((e) => e.event === 'tess.turn');
  assert.equal(turnEvents.length, 1);
  assert.equal(turnEvents[0].payload.timed_out, true);
  assert.equal(turnEvents[0].payload.tess_credits, null);
  assert.equal(turnEvents[0].payload.intent, expected.intent);
  assert.equal(turnEvents[0].payload.context_profile, expected.contextProfile);
  assert.ok(turnEvents[0].payload.sent_chars > 0);
  assert.equal(Object.hasOwn(turnEvents[0].payload, 'client_phone'), false);
  assert.equal(Object.hasOwn(turnEvents[0].payload, 'phone'), false);
}

test('6.3 CANCEL abort → timeout_ms 13000, fallback honesto, zero mutação', async () => {
  const result = await processMessage(
    'story-12-timeout-session',
    'Pode cancelar esse também',
    'Cliente',
    null,
    '0007',
    'kapso-timeout-test',
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(result.response, CANCEL_TIMEOUT_COPY);
  assert.match(result.response, /não consegui cancelar/i);
  assert.match(result.response, /não foi alterado/i);
  assert.deepEqual(result.responses, [result.response]);
  assert.equal('booking' in result, false);
  assert.equal('handoff' in result, false);
  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0][0]), /tess/i);
  assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.CANCEL]);

  assertTimeoutEvent({
    clientPhone: '0007',
    intent: 'CANCEL',
    contextProfile: 'CANCEL',
    timeout_ms: 13_000,
  });
  assertTimedOutTurn({ intent: 'CANCEL', contextProfile: 'CANCEL' });
  assert.equal(
    operationalEvents.filter((e) => e.event === 'tess.context_bytes').length,
    1,
  );

  const savedTurns = queries
    .filter((entry) => /INSERT INTO conversation_history/i.test(entry.text))
    .map((entry) => entry.params.slice(0, 5));
  assert.deepEqual(savedTurns, [
    ['0007', 'user', 'Pode cancelar esse também', null, 'CANCEL'],
    ['0007', 'assistant', result.response, 'tess-timeout', 'CANCEL'],
  ]);
  assertZeroMutation();
});

test('6.4 FAQ abort → timeout_ms 13000, copy DEFAULT_TIMEOUT_COPY', async () => {
  const result = await processMessage(
    'story-6-faq-timeout',
    'aceita pix?',
    'Cliente',
    null,
    '0007',
    'kapso-faq-timeout',
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(result.response, DEFAULT_TIMEOUT_COPY);
  assert.doesNotMatch(result.response, /não consegui cancelar/i);
  assert.match(result.response, /não alterei seu agendamento/i);
  assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.FAQ]);

  assertTimeoutEvent({
    clientPhone: '0007',
    intent: 'FAQ',
    contextProfile: 'FAQ',
    timeout_ms: 13_000,
  });
  assertTimedOutTurn({ intent: 'FAQ', contextProfile: 'FAQ' });
  assertZeroMutation();
});

describe('6.5 BOOKING/FULL heavy abort', () => {
  test('BOOKING scoped → timeout_ms 22000', async () => {
    process.env.TESS_CONTEXT_MODE = 'scoped';
    const result = await processMessage(
      'story-6-booking-timeout',
      'quero agendar manicure amanhã às 14h',
      'Cliente',
      [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'ola' }],
      '0007',
      'kapso-booking-timeout',
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.response, DEFAULT_TIMEOUT_COPY);
    assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.BOOKING]);
    assertTimeoutEvent({
      clientPhone: '0007',
      intent: 'SCHEDULING',
      contextProfile: 'BOOKING',
      timeout_ms: 22_000,
    });
    assert.ok(22_000 >= 12_400);
    assertZeroMutation();
  });

  test('FULL mode → timeout_ms 22000', async () => {
    const { processMessage: processMessageFull } = loadServerFresh({
      TESS_CONTEXT_MODE: 'full',
      TESS_CONTEXT_FORCE_FULL: '0',
    });
    resetHarness();
    const result = await processMessageFull(
      'story-6-full-timeout',
      'quero agendar manicure amanhã às 14h',
      'Cliente',
      null,
      '0007',
      'kapso-full-timeout',
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.response, DEFAULT_TIMEOUT_COPY);
    assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.FULL]);
    assertTimeoutEvent({
      clientPhone: '0007',
      intent: 'SCHEDULING',
      contextProfile: 'FULL',
      timeout_ms: 22_000,
    });
    assertZeroMutation();
  });
});

test('6.6 callTESS sem timeoutMs → AbortSignal 22000, não 25000', async () => {
  resetHarness();
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: true,
      json: async () => ({ output: 'ok' }),
    };
  };
  await callTESS([{ role: 'user', content: 'ping' }], null);
  assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.FULL]);
  assert.notEqual(abortTimeouts[0], TESS_TIMEOUT_WALL_MS);
});

test('6.7 premium retry usa o mesmo abortMs do turno', async () => {
  resetHarness();
  let callCount = 0;
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: true,
        json: async () => ({ output: 'Temos horário premium exclusivo amanhã.' }),
      };
    }
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    throw error;
  };

  const result = await processMessage(
    'story-6-premium-retry-timeout',
    'Pode cancelar esse também',
    'Cliente',
    null,
    '0007',
    'kapso-premium-retry',
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(abortTimeouts, [DEFAULT_ABORT_MS.CANCEL, DEFAULT_ABORT_MS.CANCEL]);
  assert.ok(result.response.length > 0);
  assert.doesNotMatch(result.response, /\[BOOKING_/);
});

test('6.7 resume usa resolveTessAbortMs do assembledCtx', async () => {
  resetHarness();
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: true,
      json: async () => ({ output: 'Retomando atendimento.' }),
    };
  };

  const result = await runOperatorResumeTurn('0007', 'Cliente pediu retorno');
  assert.ok(result.text.length > 0);
  assert.equal(fetchCalls.length, 1);
  assert.ok(abortTimeouts.length >= 1);
  const allowedAbortMs = new Set(Object.values(DEFAULT_ABORT_MS));
  assert.ok(allowedAbortMs.has(abortTimeouts[0]), 'abort must match resolveTessAbortMs table');
  assert.ok(abortTimeouts[0] < TESS_TIMEOUT_WALL_MS);
  assert.notEqual(abortTimeouts[0], TESS_TIMEOUT_WALL_MS);
  const turnEvents = operationalEvents.filter((e) => e.event === 'tess.turn');
  assert.equal(turnEvents.length, 0, 'resume must not persist tess.turn (Quinn OBS-01)');
});
