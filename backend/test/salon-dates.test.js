const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getNextBusinessDays, extractRequestedDate, addDaysToIsoDate } = require('../lib/salon-dates');

test('getNextBusinessDays ignora domingo e segunda a partir de uma segunda', () => {
  assert.deepEqual(
    getNextBusinessDays(5, '2026-08-17'),
    ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'],
  );
});

test('getNextBusinessDays(7) inclui a terça da semana seguinte', () => {
  const days = getNextBusinessDays(7, '2026-08-17');
  assert.equal(days.length, 7);
  assert.equal(days[5], '2026-08-25');
  assert.equal(days[6], '2026-08-26');
});

test('getNextBusinessDays(10) cobre duas semanas de salão', () => {
  const days = getNextBusinessDays(10, '2026-08-17');
  assert.equal(days.length, 10);
  assert.equal(days[9], '2026-08-29');
});

test('extractRequestedDate ISO', () => {
  assert.equal(extractRequestedDate('quero dia 2026-08-25 de manhã'), '2026-08-25');
});

test('extractRequestedDate DD/MM/YYYY', () => {
  assert.equal(extractRequestedDate('dia 25/08/2026'), '2026-08-25');
});

test('extractRequestedDate 25 de agosto de 2026', () => {
  const now = new Date('2026-08-17T18:00:00-03:00');
  assert.equal(extractRequestedDate('quero cortar dia 25 de agosto de 2026', now), '2026-08-25');
});

test('extractRequestedDate 25 de agosto sem ano (mês atual/futuro)', () => {
  const now = new Date('2026-08-17T18:00:00-03:00');
  assert.equal(extractRequestedDate('quero cortar dia 25 de agosto', now), '2026-08-25');
});

test('extractRequestedDate mês passado sem ano avança o ano', () => {
  const now = new Date('2026-08-17T18:00:00-03:00');
  assert.equal(extractRequestedDate('dia 10 de julho', now), '2027-07-10');
});

test('addDaysToIsoDate cruza mês', () => {
  assert.equal(addDaysToIsoDate('2026-08-31', 1), '2026-09-01');
});
