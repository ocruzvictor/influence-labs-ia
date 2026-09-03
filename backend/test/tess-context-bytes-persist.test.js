const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logContextBytes, persistContextBytesEvent } = require('../lib/tess-context-bytes');

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
    contextProfile: 'CANCEL',
    skippedTess: false,
    mode: 'full',
    blocks: { horarios: 'grade enorme', servicos: '' },
  });
  await persistContextBytesEvent(db, logged, '5511964540007');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[0], 'tess.context_bytes');
  assert.equal(calls[0].params[1], '5511964540007');
  const payload = JSON.parse(calls[0].params[4]);
  assert.equal(payload.intent, 'CANCEL');
  assert.equal(payload.context_profile, 'CANCEL');
  assert.ok(payload.blocks.horarios.chars > 0);
  assert.equal(payload.blocks.horarios.chars, 'grade enorme'.length);
});
