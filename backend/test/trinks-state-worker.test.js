const test = require('node:test');
const assert = require('node:assert/strict');
const { nextBusinessDates, mapSlots } = require('../trinks-state-worker');
const { getNextBusinessDays, nextSaturdayDates, mergeSlotContextDates } = require('../lib/salon-dates');

test('nextBusinessDates ignora domingo e segunda', () => {
  assert.deepEqual(
    nextBusinessDates(3, new Date('2026-06-20T12:00:00Z')),
    ['2026-06-20', '2026-06-23', '2026-06-24'],
  );
});

test('mapSlots expande horários por profissional', () => {
  const rows = mapSlots('2026-06-20', {
    data: [{ id: 10, apelido: 'Ana', horariosVagos: ['09:00', '10:30'] }],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].professionalId, 10);
  assert.equal(rows[1].startsAt, '2026-06-20T10:30:00-03:00');
});

test('mergeSlotContextDates inclui sábado além dos 10 dias úteis', () => {
  const now = new Date('2026-08-20T12:00:00-03:00');
  const merged = mergeSlotContextDates(
    getNextBusinessDays(10, '2026-08-20'),
    nextSaturdayDates(5, 35, now),
  );
  assert.ok(merged.includes('2026-09-05'));
  assert.ok(!getNextBusinessDays(10, '2026-08-20').includes('2026-09-05'));
});
