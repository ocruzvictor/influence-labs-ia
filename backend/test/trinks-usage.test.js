/**
 * Testes unitários para backend/lib/trinks-usage.js (story trinks-quota-monitor).
 *   cd backend && npm test
 *
 * Granularidade DIÁRIA. db mockado (sem rede). nowFn injetado p/ controlar o dia.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { salonDayKey, salonMonthKey, recordTrinksCall, getTrinksUsage, newlyCrossed } = require('../lib/trinks-usage');

// db mock: registra queries; responde o agregado do mês conforme `monthUsed`/`todayUsed`.
function mockDb({ monthUsed = 0, todayUsed = 0 } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT COALESCE/.test(sql)) return { rows: [{ used: monthUsed, today: todayUsed }] };
      return { rows: [] }; // INSERT ... ON CONFLICT
    },
  };
}

test('salonDayKey/MonthKey — formatam no fuso do salão', () => {
  // 2026-06-10T02:00:00Z = 2026-06-09 23:00 BRT → ainda dia 09
  assert.equal(salonDayKey(new Date('2026-06-10T02:00:00Z')), '2026-06-09');
  assert.equal(salonMonthKey(new Date('2026-06-10T02:00:00Z')), '2026-06');
  assert.equal(salonDayKey(new Date('2026-06-10T12:00:00Z')), '2026-06-10');
});

test('recordTrinksCall — UPSERT incremental na chave do DIA', async () => {
  const db = mockDb();
  await recordTrinksCall(db, () => new Date('2026-06-10T15:00:00Z')); // 12:00 BRT
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO trinks_api_usage/);
  assert.match(db.calls[0].sql, /used = trinks_api_usage\.used \+ 1/);
  assert.deepEqual(db.calls[0].params, ['2026-06-10']);
});

test('recordTrinksCall — db ausente/sem query → no-op, não lança', async () => {
  await recordTrinksCall(null);
  await recordTrinksCall({});
  assert.ok(true);
});

test('getTrinksUsage — soma do mês + consumo de hoje, remaining e pct', async () => {
  const db = mockDb({ monthUsed: 8000, todayUsed: 1200 });
  const u = await getTrinksUsage(db, 10000, () => new Date('2026-06-10T15:00:00Z'));
  assert.equal(u.month, '2026-06');
  assert.equal(u.today, '2026-06-10');
  assert.equal(u.used, 8000);
  assert.equal(u.used_today, 1200);
  assert.equal(u.budget, 10000);
  assert.equal(u.remaining, 2000);
  assert.equal(u.pct, 0.8);
});

test('getTrinksUsage — mês sem registro → 0, remaining = budget', async () => {
  const db = mockDb({ monthUsed: 0, todayUsed: 0 });
  const u = await getTrinksUsage(db, 5000, () => new Date('2026-07-01T15:00:00Z'));
  assert.equal(u.used, 0);
  assert.equal(u.remaining, 5000);
  assert.equal(u.pct, 0);
});

test('getTrinksUsage — acima do budget: remaining nunca negativo', async () => {
  const db = mockDb({ monthUsed: 12000, todayUsed: 0 });
  const u = await getTrinksUsage(db, 10000, () => new Date('2026-06-20T15:00:00Z'));
  assert.equal(u.remaining, 0);
  assert.equal(u.pct, 1.2);
});

test('newlyCrossed — só thresholds cruzados e não-alertados', () => {
  assert.deepEqual(newlyCrossed(0.85, [0.8, 0.9, 1.0], new Set()), [0.8]);
  assert.deepEqual(newlyCrossed(0.95, [0.8, 0.9, 1.0], new Set([0.8])), [0.9]);
  assert.deepEqual(newlyCrossed(0.5, [0.8, 0.9, 1.0], new Set()), []);
  assert.deepEqual(newlyCrossed(1.0, [0.8, 0.9, 1.0], new Set()), [0.8, 0.9, 1.0]);
});
