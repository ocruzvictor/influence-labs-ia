/**
 * Testes unitários para backend/lib/bot-thread-state.js.
 *
 *   node --test backend/test/bot-thread-state.test.js
 */

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../db');
const botThreadStatePath = require.resolve('../lib/bot-thread-state');
const ownerAccessPath = require.resolve('../lib/owner-access');

/** @type {Map<string, { silenced_until: string | null, silence_reason: string | null }>} */
let store = new Map();
let queryLog = [];

function setupMockDb() {
  store = new Map();
  queryLog = [];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, params) => {
        queryLog.push({ sql, params });

        if (sql.includes('INSERT INTO bot_thread_state')) {
          const [phone, silencedUntil, reason] = params;
          if (sql.includes('last_staff_outbound_at') && params.length === 1) {
            const p = params[0];
            store.set(p, { ...(store.get(p) || {}), last_staff_outbound_at: new Date().toISOString() });
            return { rows: [] };
          }
          if (sql.includes('last_staff_outbound_at')) {
            store.set(phone, {
              ...(store.get(phone) || {}),
              last_staff_outbound_at: new Date().toISOString(),
            });
            return { rows: [] };
          }
          store.set(phone, {
            silenced_until: silencedUntil,
            silence_reason: reason,
          });
          return { rows: [] };
        }

        if (sql.includes('SELECT silenced_until FROM bot_thread_state')) {
          const phone = params[0];
          const row = store.get(phone);
          if (!row) return { rows: [] };
          return { rows: [{ silenced_until: row.silenced_until }] };
        }

        if (sql.includes('SELECT last_staff_outbound_at FROM bot_thread_state')) {
          const phone = params[0];
          const row = store.get(phone);
          if (!row?.last_staff_outbound_at) return { rows: [] };
          return { rows: [{ last_staff_outbound_at: row.last_staff_outbound_at }] };
        }

        if (sql.includes('COUNT(*)')) {
          const now = Date.now();
          let cnt = 0;
          for (const row of store.values()) {
            if (row.silenced_until && new Date(row.silenced_until).getTime() > now) {
              cnt += 1;
            }
          }
          return { rows: [{ cnt }] };
        }

        return { rows: [] };
      },
    },
  };
  delete require.cache[botThreadStatePath];
}

function setupOwnerPhones(phones) {
  require.cache[ownerAccessPath] = {
    id: ownerAccessPath,
    filename: ownerAccessPath,
    loaded: true,
    exports: {
      digitsOnly: (v) => String(v || '').replace(/\D/g, ''),
      isOwnerPhone: (phone, ownerPhones = phones) => {
        const digits = String(phone || '').replace(/\D/g, '');
        return ownerPhones.includes(digits);
      },
      getOwnerPhones: () => phones,
    },
  };
  delete require.cache[botThreadStatePath];
}

function teardown() {
  delete require.cache[dbPath];
  delete require.cache[botThreadStatePath];
  delete require.cache[ownerAccessPath];
}

beforeEach(() => {
  setupMockDb();
  setupOwnerPhones(['5511937750330']);
});

afterEach(teardown);

test('set silencio → invalidate cache → isHumanHandled ainda true (Postgres)', async () => {
  const {
    markHumanHandled,
    isHumanHandled,
    invalidatePhoneCache,
    resetCacheForTests,
  } = require('../lib/bot-thread-state');

  const phone = '5511964540007';
  const ttlMs = 60 * 60 * 1000;

  await markHumanHandled(phone, 'handoff', { ttlMs });
  assert.equal(await isHumanHandled(phone), true);

  resetCacheForTests();
  invalidatePhoneCache(phone);

  assert.equal(await isHumanHandled(phone), true);
  assert.ok(store.has(phone));
});

test('TTL expirado → isHumanHandled false', async () => {
  const { isHumanHandled, resetCacheForTests } = require('../lib/bot-thread-state');

  const phone = '5511964540007';
  const past = new Date(Date.now() - 60_000).toISOString();
  store.set(phone, { silenced_until: past, silence_reason: 'handoff' });
  resetCacheForTests();

  assert.equal(await isHumanHandled(phone), false);
});

test('owner phone não silencia (skip mark + isHumanHandled false)', async () => {
  const { markHumanHandled, isHumanHandled } = require('../lib/bot-thread-state');

  const owner = '5511937750330';
  await markHumanHandled(owner, 'handoff', { ttlMs: 60 * 60 * 1000 });

  assert.equal(store.has(owner), false);
  assert.equal(queryLog.some((q) => q.sql.includes('INSERT')), false);
  assert.equal(await isHumanHandled(owner), false);
});

test('countActiveSilenced conta apenas silencios ativos', async () => {
  const { markHumanHandled, countActiveSilenced } = require('../lib/bot-thread-state');

  await markHumanHandled('5511111111111', 'business_app', { ttlMs: 60 * 60 * 1000 });
  store.set('5511222222222', {
    silenced_until: new Date(Date.now() - 1000).toISOString(),
    silence_reason: 'handoff',
  });

  assert.equal(await countActiveSilenced(), 1);
});

test('cache hit evita segunda query SELECT dentro do TTL', async () => {
  const {
    markHumanHandled,
    isHumanHandled,
    resetCacheForTests,
  } = require('../lib/bot-thread-state');

  const phone = '5511964540007';
  await markHumanHandled(phone, 'handoff', { ttlMs: 60 * 60 * 1000 });
  resetCacheForTests();

  await isHumanHandled(phone);
  const selectsAfterFirstRead = queryLog.filter((q) => q.sql.includes('SELECT silenced_until')).length;
  await isHumanHandled(phone);
  const selectsAfterSecondRead = queryLog.filter((q) => q.sql.includes('SELECT silenced_until')).length;

  assert.equal(selectsAfterSecondRead, selectsAfterFirstRead);
});

test('persistStaffOutbound grava last_staff_outbound_at', async () => {
  const { persistStaffOutbound } = require('../lib/bot-thread-state');

  const phone = '5511964540007';
  await persistStaffOutbound(phone);

  assert.ok(store.get(phone)?.last_staff_outbound_at);
  assert.ok(queryLog.some((q) => q.sql.includes('last_staff_outbound_at')));
});

test('isStaffSpokeRecently true dentro de 10 min; false se ausente', async () => {
  const { persistStaffOutbound, isStaffSpokeRecently } = require('../lib/bot-thread-state');
  const phone = '5511999998888';
  assert.equal(await isStaffSpokeRecently(phone), false);
  await persistStaffOutbound(phone);
  assert.equal(await isStaffSpokeRecently(phone), true);
});

test('hasStaffOnConversation usa janela de 24h, não só a tag', async () => {
  const { persistStaffOutbound, hasStaffOnConversation } = require('../lib/bot-thread-state');
  const phone = '5511999997777';
  assert.equal(await hasStaffOnConversation(phone), false);
  await persistStaffOutbound(phone);
  assert.equal(await hasStaffOnConversation(phone), true);
});
