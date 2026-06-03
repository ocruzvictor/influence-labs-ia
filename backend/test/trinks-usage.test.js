/**
 * Testes unitários para backend/lib/trinks-usage.js (story trinks-quota-monitor).
 *   cd backend && npm test
 *
 * db mockado (sem rede/Postgres). nowFn injetado p/ controlar o mês.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { salonMonthKey, recordTrinksCall, getTrinksUsage, newlyCrossed } = require('../lib/trinks-usage');

// db mock que registra queries e devolve respostas roteiradas.
function mockDb(rowsFor = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT used/.test(sql)) {
        const key = params[0];
        return { rows: rowsFor[key] != null ? [{ used: rowsFor[key] }] : [] };
      }
      return { rows: [] }; // INSERT ... ON CONFLICT
    },
  };
}

test('salonMonthKey — formata YYYY-MM no fuso do salão', () => {
  // 2026-06-03T01:00:00Z = 2026-06-02 22:00 BRT → ainda junho
  assert.equal(salonMonthKey(new Date('2026-06-03T01:00:00Z')), '2026-06');
  assert.equal(salonMonthKey(new Date('2026-01-15T12:00:00Z')), '2026-01');
});

test('getTrinksUsage — calcula remaining e pct', async () => {
  const db = mockDb({ '2026-06': 8000 });
  const u = await getTrinksUsage(db, 10000, () => new Date('2026-06-10T12:00:00Z'));
  assert.equal(u.month, '2026-06');
  assert.equal(u.used, 8000);
  assert.equal(u.budget, 10000);
  assert.equal(u.remaining, 2000);
  assert.equal(u.pct, 0.8);
});

test('getTrinksUsage — mês sem registro → used 0, remaining = budget', async () => {
  const db = mockDb({});
  const u = await getTrinksUsage(db, 5000, () => new Date('2026-07-01T12:00:00Z'));
  assert.equal(u.used, 0);
  assert.equal(u.remaining, 5000);
  assert.equal(u.pct, 0);
});

test('getTrinksUsage — acima do budget: remaining nunca negativo', async () => {
  const db = mockDb({ '2026-06': 12000 });
  const u = await getTrinksUsage(db, 10000, () => new Date('2026-06-20T12:00:00Z'));
  assert.equal(u.remaining, 0);
  assert.equal(u.pct, 1.2);
});

test('recordTrinksCall — faz UPSERT incremental na chave do mês', async () => {
  const db = mockDb({});
  await recordTrinksCall(db, () => new Date('2026-06-03T12:00:00Z'));
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO trinks_api_usage/);
  assert.match(db.calls[0].sql, /used = trinks_api_usage\.used \+ 1/);
  assert.deepEqual(db.calls[0].params, ['2026-06']);
});

test('recordTrinksCall — db ausente/sem query → no-op, não lança', async () => {
  await recordTrinksCall(null);
  await recordTrinksCall({});
  assert.ok(true); // não lançou
});

test('newlyCrossed — retorna só thresholds cruzados e não-alertados', () => {
  assert.deepEqual(newlyCrossed(0.85, [0.8, 0.9, 1.0], new Set()), [0.8]);
  assert.deepEqual(newlyCrossed(0.95, [0.8, 0.9, 1.0], new Set([0.8])), [0.9]);
  assert.deepEqual(newlyCrossed(1.0, [0.8, 0.9, 1.0], new Set([0.8, 0.9])), [1.0]);
  assert.deepEqual(newlyCrossed(0.5, [0.8, 0.9, 1.0], new Set()), []);
  assert.deepEqual(newlyCrossed(0.9, [0.8, 0.9, 1.0], new Set([0.8, 0.9])), []);
});

test('newlyCrossed — salto grande dispara múltiplos de uma vez', () => {
  assert.deepEqual(newlyCrossed(1.0, [0.8, 0.9, 1.0], new Set()), [0.8, 0.9, 1.0]);
});
