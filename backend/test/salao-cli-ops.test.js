const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  listStuckThreadsFiltered,
  listAckWithoutOutbound,
  checarFrescuraSnapshot,
} = require('../lib/salao-cli-ops');

test('listStuckThreadsFiltered hides silenced and human_only', async () => {
  const now = new Date();
  const db = {
    query: async () => ({
      rows: [
        {
          client_phone: '5511964540007',
          role: 'user',
          content: 'oi',
          created_at: new Date(now.getTime() - 10 * 60000),
          whitelist_mode: 'allow',
          silenced_until: null,
        },
        {
          client_phone: '5511999991111',
          role: 'user',
          content: 'quero humano',
          created_at: new Date(now.getTime() - 20 * 60000),
          whitelist_mode: 'human_only',
          silenced_until: null,
        },
        {
          client_phone: '5511999992222',
          role: 'user',
          content: 'handoff',
          created_at: new Date(now.getTime() - 15 * 60000),
          whitelist_mode: null,
          silenced_until: new Date(now.getTime() + 3600000),
        },
      ],
    }),
  };
  const result = await listStuckThreadsFiltered(db, { filtrarSilence: true });
  assert.equal(result.total_raw, 3);
  assert.equal(result.total_visible, 1);
  assert.equal(result.threads[0].last4, '0007');
});

test('listAckWithoutOutbound redacts to last4', async () => {
  const db = {
    query: async () => ({
      rows: [{
        client_phone: '5511964540007',
        role: 'user',
        content: 'alô',
        created_at: new Date(Date.now() - 120000),
        agent: 'passive',
      }],
    }),
  };
  const result = await listAckWithoutOutbound(db, { minutos: 60, segundos: 45 });
  assert.equal(result.silences[0].last4, '0007');
  assert.ok(!JSON.stringify(result).includes('5511964540007'));
});

test('checarFrescuraSnapshot marks stale parts', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('UNION ALL')) {
        return {
          rows: [
            { kind: 'professionals', synced_at: new Date(Date.now() - 2 * 3600000), n: 12 },
            { kind: 'slots', synced_at: new Date(Date.now() - 48 * 3600000), n: 10 },
          ],
        };
      }
      return { rows: [{ covered: true }] };
    },
  };
  const result = await checarFrescuraSnapshot(db, { maxIdadeHoras: 24 });
  assert.equal(result.stale, true);
  assert.equal(result.parts.find((p) => p.kind === 'slots').stale, true);
  assert.equal(result.parts.find((p) => p.kind === 'professionals').stale, false);
});
