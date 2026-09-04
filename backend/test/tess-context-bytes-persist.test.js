const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logContextBytes, persistContextBytesEvent, persistTessTurnEvent } = require('../lib/tess-context-bytes');

test('persistContextBytesEvent writes tess.context_bytes without block text', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 1 }] };
    },
  };
  const logged = logContextBytes({
    sessionId: 's1',
    intent: 'CANCEL',
    confidence: 'high',
    contextProfile: 'CANCEL',
    skippedTess: false,
    mode: 'full',
    traceId: 'trace-1',
    blocks: { horarios: 'grade enorme', servicos: '' },
  });
  await persistContextBytesEvent(db, logged, '5511964540007');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[0], 'tess.context_bytes');
  assert.equal(calls[0].params[1], '5511964540007');
  const payload = JSON.parse(calls[0].params[4]);
  assert.equal(payload.intent, 'CANCEL');
  assert.equal(payload.confidence, 'high');
  assert.equal(payload.context_profile, 'CANCEL');
  assert.equal(payload.trace_id, 'trace-1');
  assert.ok(payload.blocks.horarios.chars > 0);
  assert.equal(payload.blocks.horarios.chars, 'grade enorme'.length);
});

test('persistTessTurnEvent writes credits with intent and profile', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 1 }] };
    },
  };
  await persistTessTurnEvent(db, {
    clientPhone: '5511964540007',
    intent: 'SCHEDULING',
    confidence: 'high',
    contextProfile: 'BOOKING',
    tessCredits: 13.5,
    totalChars: 4000,
    traceId: 'trace-2',
  });
  assert.equal(calls[0].params[0], 'tess.turn');
  const payload = JSON.parse(calls[0].params[4]);
  assert.equal(payload.tess_credits, 13.5);
  assert.equal(payload.context_profile, 'BOOKING');
  assert.equal(payload.confidence, 'high');
  assert.equal(payload.trace_id, 'trace-2');
});
