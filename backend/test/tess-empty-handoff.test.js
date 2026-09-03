/**
 * Unit tests — tess.empty + credits=0 handoff (Story P0.7).
 *   node --test backend/test/tess-empty-handoff.test.js
 */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const ownerAccessPath = require.resolve('../lib/owner-access');
const botThreadStatePath = require.resolve('../lib/bot-thread-state');

let markHandledCalls = 0;
let emittedEvents = [];
let threadStore = new Map();

function setupMocks({ ownerPhones = [] } = {}) {
  markHandledCalls = 0;
  emittedEvents = [];
  threadStore = new Map();

  require.cache[ownerAccessPath] = {
    id: ownerAccessPath,
    filename: ownerAccessPath,
    loaded: true,
    exports: {
      digitsOnly: (p) => String(p || '').replace(/\D/g, ''),
      isOwnerPhone: (p) => ownerPhones.includes(String(p || '').replace(/\D/g, '')),
    },
  };

  require.cache[botThreadStatePath] = {
    id: botThreadStatePath,
    filename: botThreadStatePath,
    loaded: true,
    exports: {
      markHumanHandled: async (phone, reason) => {
        markHandledCalls += 1;
        threadStore.set(phone, { silence_reason: reason, silenced_until: new Date(Date.now() + 3600000).toISOString() });
      },
    },
  };

  delete require.cache[require.resolve('../lib/tess-empty-handoff')];
  delete require.cache[require.resolve('../lib/operational-events')];
}

beforeEach(() => setupMocks());

test('0101-class — empty + credits=0 → handoff.human + bot_thread_state', async () => {
  setupMocks();
  const { handleEmptyTessHandoff, shouldHandoffEmptyTess } = require('../lib/tess-empty-handoff');
  const { shouldEmitHandoff } = require('../lib/operational-events');

  assert.equal(shouldHandoffEmptyTess(0), true);
  assert.equal(shouldHandoffEmptyTess(null), false);
  assert.equal(shouldHandoffEmptyTess(5), false);

  const phone = '5511999990101';
  const result = await handleEmptyTessHandoff({
    credits: 0,
    phone,
    db: {},
    kapsoConversationId: 'kapso-1',
    markHumanHandled: async (p, r) => {
      markHandledCalls += 1;
      threadStore.set(p, { silence_reason: r });
    },
    shouldEmitHandoff,
    emitOperationalEvent: async (_db, evt) => {
      emittedEvents.push(evt);
    },
  });

  assert.equal(result.handoff, true);
  assert.equal(result.silenced, true);
  assert.equal(markHandledCalls, 1);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0].event, 'handoff.human');
  assert.ok(threadStore.has(phone));
});

test('fallback Kapso sozinho falha — sem evento e sem row', async () => {
  const { shouldHandoffEmptyTess } = require('../lib/tess-empty-handoff');
  assert.equal(shouldHandoffEmptyTess(0), true);
  assert.equal(markHandledCalls, 0);
  assert.equal(emittedEvents.length, 0);
  assert.equal(threadStore.size, 0);
});

test('empty + credits>0 → sem handoff obrigatório', async () => {
  setupMocks();
  const { handleEmptyTessHandoff } = require('../lib/tess-empty-handoff');
  const { shouldEmitHandoff } = require('../lib/operational-events');

  const result = await handleEmptyTessHandoff({
    credits: 12,
    phone: '5511999998888',
    db: {},
    kapsoConversationId: null,
    markHumanHandled: async () => { markHandledCalls += 1; },
    shouldEmitHandoff,
    emitOperationalEvent: async (_db, evt) => { emittedEvents.push(evt); },
  });

  assert.equal(result.handoff, false);
  assert.equal(markHandledCalls, 0);
  assert.equal(emittedEvents.length, 0);
});

test('owner phone — não silencia nem emite handoff', async () => {
  setupMocks({ ownerPhones: ['5511995095131'] });
  const { handleEmptyTessHandoff } = require('../lib/tess-empty-handoff');
  const { shouldEmitHandoff } = require('../lib/operational-events');

  const result = await handleEmptyTessHandoff({
    credits: 0,
    phone: '5511995095131',
    db: {},
    kapsoConversationId: null,
    markHumanHandled: async () => { markHandledCalls += 1; },
    shouldEmitHandoff,
    emitOperationalEvent: async (_db, evt) => { emittedEvents.push(evt); },
  });

  assert.equal(result.handoff, false);
  assert.equal(result.silenced, false);
  assert.equal(markHandledCalls, 0);
});
