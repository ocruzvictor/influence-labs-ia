const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MOTIVO_MAX,
  sliceMotivo,
  shouldEmitHandoff,
  emitOperationalEvent,
} = require('../lib/operational-events');

test('shouldEmitHandoff skips owner phone 5511937750330', () => {
  assert.equal(shouldEmitHandoff('5511937750330'), false);
  assert.equal(shouldEmitHandoff('+55 11 93775-0330'), false);
});

test('shouldEmitHandoff allows non-owner phones', () => {
  assert.equal(shouldEmitHandoff('5511964540007'), true);
  assert.equal(shouldEmitHandoff('5511999990000'), true);
});

test('shouldEmitHandoff rejects empty phone', () => {
  assert.equal(shouldEmitHandoff(''), false);
  assert.equal(shouldEmitHandoff(null), false);
});

test('sliceMotivo truncates long text', () => {
  const long = 'x'.repeat(MOTIVO_MAX + 50);
  assert.equal(sliceMotivo(long).length, MOTIVO_MAX);
  assert.equal(sliceMotivo('  curto  '), 'curto');
});

test('emitOperationalEvent persists handoff.human with digits-only phone', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 1 }] };
    },
  };

  await emitOperationalEvent(db, {
    event: 'handoff.human',
    clientPhone: '+55 11 96454-0007',
    motivo: 'cliente_pediu_humano',
    kapsoConversationId: 'conv-abc',
    payload: { source: 'test' },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO bot_operational_events/);
  assert.equal(calls[0].params[0], 'handoff.human');
  assert.equal(calls[0].params[1], '5511964540007');
  assert.equal(calls[0].params[2], 'cliente_pediu_humano');
  assert.equal(calls[0].params[3], 'conv-abc');
  assert.deepEqual(JSON.parse(calls[0].params[4]), { source: 'test' });
});

test('emitOperationalEvent persists booking.failed', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 2 }] };
    },
  };

  await emitOperationalEvent(db, {
    event: 'booking.failed',
    clientPhone: '5511999990000',
    motivo: 'Trinks timeout',
    kapsoConversationId: null,
  });

  assert.equal(calls[0].params[0], 'booking.failed');
  assert.equal(calls[0].params[3], null);
});

test('emitOperationalEvent swallows persist errors', async () => {
  const db = {
    query: async () => {
      throw new Error('relation "bot_operational_events" does not exist');
    },
  };

  await assert.doesNotReject(() => emitOperationalEvent(db, {
    event: 'handoff.human',
    clientPhone: '5511964540007',
    motivo: 'test',
  }));
});

test('emitOperationalEvent no-ops without db', async () => {
  await assert.doesNotReject(() => emitOperationalEvent(null, {
    event: 'handoff.human',
    clientPhone: '5511964540007',
    motivo: 'test',
  }));
});
