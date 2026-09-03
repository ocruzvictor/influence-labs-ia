/**
 * Integration-style unit test — processMessage timeout boundary (Story 12).
 * Uses only local stubs; no TESS, Trinks or Kapso network calls.
 */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');
const originalDbQuery = db.query;
const originalFetch = global.fetch;
const originalEnv = {
  TESS_CONTEXT_MODE: process.env.TESS_CONTEXT_MODE,
  TESS_CONTEXT_FORCE_FULL: process.env.TESS_CONTEXT_FORCE_FULL,
  TESS_WORKSPACE_ID: process.env.TESS_WORKSPACE_ID,
  TESS_API_TOKEN: process.env.TESS_API_TOKEN,
};

const queries = [];
const fetchCalls = [];
const operationalEvents = [];

process.env.TESS_CONTEXT_MODE = 'full';
process.env.TESS_CONTEXT_FORCE_FULL = '0';
process.env.TESS_WORKSPACE_ID = '1458234';
process.env.TESS_API_TOKEN = 'test-token';

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
  return { rows: [] };
};

global.fetch = async (...args) => {
  fetchCalls.push(args);
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  throw error;
};

const { processMessage } = require('../server');

after(() => {
  db.query = originalDbQuery;
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('processMessage timeout → fallback enviado, evento e zero mutação/silêncio', async () => {
  const result = await processMessage(
    'story-12-timeout-session',
    'Pode cancelar esse também',
    'Cliente',
    null,
    '0007',
    'kapso-timeout-test',
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(result.response, /não consegui cancelar/i);
  assert.match(result.response, /não foi alterado/i);
  assert.deepEqual(result.responses, [result.response]);
  assert.equal('booking' in result, false);
  assert.equal('handoff' in result, false);
  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0][0]), /tess/i);

  const timeoutEvents = operationalEvents.filter((e) => e.event === 'tess.timeout');
  assert.equal(timeoutEvents.length, 1);
  assert.equal(timeoutEvents[0].clientPhone, '0007');
  assert.deepEqual(timeoutEvents[0].payload, {
    intent: 'CANCEL',
    contextProfile: 'CANCEL',
    timeout_ms: 25_000,
  });
  assert.equal(
    operationalEvents.filter((e) => e.event === 'tess.context_bytes').length,
    1,
  );

  const savedTurns = queries
    .filter((entry) => /INSERT INTO conversation_history/i.test(entry.text))
    .map((entry) => entry.params);
  assert.deepEqual(savedTurns, [
    ['0007', 'user', 'Pode cancelar esse também', null, 'CANCEL'],
    ['0007', 'assistant', result.response, 'tess-timeout', 'CANCEL'],
  ]);

  const sql = queries.map((entry) => entry.text).join('\n');
  assert.doesNotMatch(sql, /UPDATE bot_thread_state/i);
  assert.doesNotMatch(sql, /trinks_api_requests/i);
  assert.doesNotMatch(sql, /booking\.cancelled/i);
  assert.doesNotMatch(sql, /tags\.parsed/i);
});
