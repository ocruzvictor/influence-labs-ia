const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getNextBusinessDays, extractRequestedDate, addDaysToIsoDate, isSalonOpen, bookingFitsExpediente } = require('../lib/salon-dates');

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

test('isSalonOpen — sexta 18:59 aberto, 19:00 fechado', () => {
  assert.equal(isSalonOpen(new Date('2026-08-21T18:59:00-03:00')).open, true);
  assert.equal(isSalonOpen(new Date('2026-08-21T19:00:00-03:00')).open, false);
});

test('isSalonOpen — sábado 17:59 aberto, 18:00 fechado', () => {
  assert.equal(isSalonOpen(new Date('2026-08-22T17:59:00-03:00')).open, true);
  assert.equal(isSalonOpen(new Date('2026-08-22T18:00:00-03:00')).open, false);
});

test('isSalonOpen — domingo e segunda fechados; terça 9h aberto', () => {
  assert.equal(isSalonOpen(new Date('2026-08-16T12:00:00-03:00')).open, false);
  assert.equal(isSalonOpen(new Date('2026-08-17T12:00:00-03:00')).open, false);
  assert.equal(isSalonOpen(new Date('2026-08-18T08:59:00-03:00')).open, false);
  assert.equal(isSalonOpen(new Date('2026-08-18T09:00:00-03:00')).open, true);
});

test('bookingFitsExpediente — sexta 18:00+60 fecha às 19:00 (ok); 18:30+60 estoura', () => {
  assert.equal(bookingFitsExpediente('2026-08-21', '18:00', 60).ok, true);
  assert.equal(bookingFitsExpediente('2026-08-21', '18:30', 60).ok, false);
});

test('bookingFitsExpediente — sexta 19:00/19:30 e 23:40+90 (smoke Gabriel) rejeitados', () => {
  assert.equal(bookingFitsExpediente('2026-08-21', '19:00', 0).ok, false);
  assert.equal(bookingFitsExpediente('2026-08-21', '19:30', 60).ok, false);
  assert.equal(bookingFitsExpediente('2026-08-21', '23:40', 90).ok, false);
});

test('bookingFitsExpediente — sábado 17:00+60 ok; 17:30+60 estoura', () => {
  assert.equal(bookingFitsExpediente('2026-08-22', '17:00', 60).ok, true);
  assert.equal(bookingFitsExpediente('2026-08-22', '17:30', 60).ok, false);
});
