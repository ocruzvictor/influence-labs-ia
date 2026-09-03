const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clipIntent, saveConversationTurns } = require('../lib/conversation-history');

test('clipIntent respects VARCHAR(20)', () => {
  assert.equal(clipIntent('SCHEDULING'), 'SCHEDULING');
  assert.equal(clipIntent('HANDOFF_LIKELY'), 'HANDOFF_LIKELY');
  assert.equal(clipIntent(null), null);
  assert.equal(clipIntent('x'.repeat(25)).length, 20);
});

test('saveConversationTurns writes intent on the existing column', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await saveConversationTurns(db, '+55 11 96454-0007', [
    { role: 'user', content: 'cancela', intent: 'CANCEL' },
    { role: 'assistant', content: 'não cancelei', agent: 'tess-timeout', intent: 'CANCEL' },
  ]);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO conversation_history/);
  assert.match(calls[0].sql, /intent/);
  assert.equal(calls[0].params[0], '5511964540007');
  assert.equal(calls[0].params[4], 'CANCEL');
  assert.equal(calls[1].params[3], 'tess-timeout');
  assert.equal(calls[1].params[4], 'CANCEL');
});

test('saveConversationTurns leaves intent null when absent', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await saveConversationTurns(db, '5511999990000', [
    { role: 'user', content: 'oi', agent: 'passive' },
  ]);
  assert.equal(calls[0].params[4], null);
});
