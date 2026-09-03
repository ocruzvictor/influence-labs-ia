/**
 * Testes unitários para backend/lib/tess-credit-usage.js
 *   cd backend && npm test
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  salonDayKey,
  recordTessCredits,
  getTessCreditUsage,
  newlyCrossed,
  newlyDropped,
  extractAccountRemaining,
  sumUsageCredits,
  fetchTessAccountSnapshot,
  resetTessAccountCache,
  formatTessCreditAlert,
} = require('../lib/tess-credit-usage');

function mockDb({ credits_used = 0, calls = 0, alerted_thresholds = [] } = {}) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/SELECT credits_used/.test(sql)) {
        return { rows: [{ credits_used, calls, alerted_thresholds }] };
      }
      return { rows: [] };
    },
  };
}

test('recordTessCredits — UPSERT incremental com créditos fracionários', async () => {
  const db = mockDb();
  await recordTessCredits(db, 12.88, () => new Date('2026-09-01T15:00:00Z'));
  assert.equal(db.queries.length, 1);
  assert.match(db.queries[0].sql, /INSERT INTO tess_credit_usage_daily/);
  assert.match(db.queries[0].sql, /credits_used = tess_credit_usage_daily\.credits_used \+ EXCLUDED\.credits_used/);
  assert.deepEqual(db.queries[0].params, ['2026-09-01', 12.88]);
});

test('recordTessCredits — skip 0 cr registra chamada', async () => {
  const db = mockDb();
  await recordTessCredits(db, 0, () => new Date('2026-09-01T15:00:00Z'));
  assert.equal(db.queries.length, 1);
  assert.deepEqual(db.queries[0].params, ['2026-09-01', 0]);
});

test('recordTessCredits — null/undefined → no-op', async () => {
  const db = mockDb();
  await recordTessCredits(db, null);
  await recordTessCredits(db, undefined);
  assert.equal(db.queries.length, 0);
});

test('recordTessCredits — db ausente → no-op', async () => {
  await recordTessCredits(null, 5);
  await recordTessCredits({}, 5);
  assert.ok(true);
});

test('getTessCreditUsage — dia, used, calls, budget, pct, remaining', async () => {
  const db = mockDb({ credits_used: 520.5, calls: 42 });
  const u = await getTessCreditUsage(db, 1000, () => new Date('2026-09-01T15:00:00Z'));
  assert.equal(u.day, '2026-09-01');
  assert.equal(u.credits_used, 520.5);
  assert.equal(u.calls, 42);
  assert.equal(u.budget, 1000);
  assert.equal(u.remaining, 479.5);
  assert.equal(u.pct, 0.521);
});

test('getTessCreditUsage — acima do budget: remaining nunca negativo', async () => {
  const db = mockDb({ credits_used: 1200, calls: 10 });
  const u = await getTessCreditUsage(db, 1000, () => new Date('2026-09-01T15:00:00Z'));
  assert.equal(u.remaining, 0);
  assert.equal(u.pct, 1.2);
});

test('newlyCrossed — thresholds absolutos 500 depois 800', () => {
  const thresholds = [500, 800, 950];
  const alerted = new Set();
  assert.deepEqual(newlyCrossed(480, thresholds, alerted), []);
  assert.deepEqual(newlyCrossed(510, thresholds, alerted), [500]);
  alerted.add(500);
  assert.deepEqual(newlyCrossed(810, thresholds, alerted), [800]);
});

test('day rollover — alert set reseta ao mudar salon day', () => {
  let state = { day: '2026-09-01', alerted: new Set([500, 800]) };
  const usageDay = '2026-09-02';
  if (state.day !== usageDay) state = { day: usageDay, alerted: new Set() };
  const thresholds = [500, 800, 950];
  assert.deepEqual(newlyCrossed(600, thresholds, state.alerted), [500]);
  assert.equal(salonDayKey(new Date('2026-09-02T12:00:00Z')), '2026-09-02');
});

test('extractAccountRemaining — ignora credits por execução em /workspaces/usage', () => {
  const remaining = extractAccountRemaining({
    items: [
      { id: '1', credits: 25.8, used_model: 'claude', status: 'succeeded' },
      { id: '2', credits: 12.2, used_model: 'claude', status: 'succeeded' },
    ],
    pagination: { current_page: 1, per_page: 20, has_more: false },
  });
  assert.equal(remaining, null);
});

test('extractAccountRemaining — carteira monthly + purchased', () => {
  assert.equal(extractAccountRemaining({
    wallet: { monthly_credits: 0, purchased_credits: 907.4 },
  }), 907.4);
});

test('extractAccountRemaining — ignora balance de user/workspace genérico', () => {
  assert.equal(extractAccountRemaining({
    id: 1458234,
    name: 'Studio Tirra',
    user: { balance: 0 },
  }), null);
});

test('extractAccountRemaining — credits.remaining aninhado', () => {
  assert.equal(extractAccountRemaining({
    data: { credits: { remaining: 912.15 } },
  }), 912.15);
});

test('sumUsageCredits — soma items da API', () => {
  assert.equal(sumUsageCredits({
    items: [{ credits: 25.8 }, { credits: 0 }, { credits: 12.2 }],
  }), 38);
});

test('newlyDropped — remaining 907 não dispara 500; 400 dispara', () => {
  const thresholds = [500, 200, 50];
  assert.deepEqual(newlyDropped(907, thresholds, new Set()), []);
  assert.deepEqual(newlyDropped(400, thresholds, new Set()), [500]);
  const alerted = new Set([500]);
  assert.deepEqual(newlyDropped(180, thresholds, alerted), [200]);
});

test('getTessCreditUsage — remaining da conta prevalece sobre budget local', async () => {
  const db = mockDb({ credits_used: 520.5, calls: 42 });
  const u = await getTessCreditUsage(
    db,
    1000,
    () => new Date('2026-09-01T15:00:00Z'),
    {
      accountFetcher: async () => ({ used: 592.9, remaining: 907.1, source: 'account' }),
    },
  );
  assert.equal(u.credits_used, 520.5);
  assert.equal(u.account_used, 592.9);
  assert.equal(u.account_remaining, 907.1);
  assert.equal(u.remaining, 907.1);
  assert.equal(u.remaining_source, 'account');
});

test('formatTessCreditAlert — mostra remaining da conta, não budget-used', () => {
  const msg = formatTessCreditAlert({
    day: '2026-09-01',
    accountRemaining: 907.1,
    accountUsed: 592.9,
    calls: 24,
    threshold: 500,
  });
  assert.match(msg, /restam 907\.10 na conta/);
  assert.match(msg, /Usados hoje \(API\): 592\.90/);
  assert.doesNotMatch(msg, /479/);
});

test('fetchTessAccountSnapshot — usage + /subscriptions remaining', async () => {
  resetTessAccountCache();
  const fetchFn = async (url) => {
    const u = String(url);
    if (u.includes('/workspaces/usage')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          items: [{ credits: 25.8 }, { credits: 567.1 }],
          pagination: { has_more: false },
        }),
      };
    }
    if (u.includes('/subscriptions')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ credits: { remaining: 907.1 } }),
      };
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  const snap = await fetchTessAccountSnapshot({
    fetchFn,
    authHeaders: { Authorization: 'Bearer x', 'x-workspace-id': '1458234' },
    apiBase: 'https://api.tess.im',
    workspaceId: '1458234',
    day: '2026-09-01',
    nowMs: 1,
    cacheMs: 0,
    remainingPaths: ['/subscriptions'],
  });
  assert.equal(snap.used, 592.9);
  assert.equal(snap.remaining, 907.1);
  resetTessAccountCache();
});
