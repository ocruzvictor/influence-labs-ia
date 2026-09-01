const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  inferGrainMinutes,
  annotateStarts,
  formatAnnotatedTimes,
  bookingFitsSlotWindow,
} = require('../lib/slot-windows');

/** Fixture Fefe 05/09: só 14:00 e 14:30 livres; 15:00 ocupado (Michelle 120min). */
const FEFE_0509 = [
  new Date('2026-09-05T14:00:00-03:00'),
  new Date('2026-09-05T14:30:00-03:00'),
];

test('inferGrainMinutes — 30 min na grade Fefe', () => {
  assert.equal(inferGrainMinutes(FEFE_0509.map((d) => d.getTime())), 30);
});

test('annotateStarts — Fefe 05/09: 14:00 cabe 60min, 14:30 cabe 30min', () => {
  const rows = annotateStarts(FEFE_0509);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].contiguousMinutes, 60);
  assert.equal(rows[1].contiguousMinutes, 30);
});

test('formatAnnotatedTimes — anota contínuos no texto injetado', () => {
  const text = formatAnnotatedTimes(FEFE_0509);
  assert.match(text, /14:00 \(60min contínuos\)/);
  assert.match(text, /14:30 \(30min contínuos\)/);
});

test('bookingFitsSlotWindow — maquiagem 120min não cabe em 14:00 nem 14:30', () => {
  assert.equal(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:00', 120).ok, false);
  assert.equal(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:30', 120).ok, false);
  assert.match(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:00', 120).reason, /janela continua/);
});

test('bookingFitsSlotWindow — esmaltação 30min cabe em 14:30; 60min cabe só em 14:00', () => {
  assert.equal(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:30', 30).ok, true);
  assert.equal(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:00', 60).ok, true);
  assert.equal(bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '14:30', 60).ok, false);
});

test('bookingFitsSlotWindow — início fora da grade livre', () => {
  const fit = bookingFitsSlotWindow(FEFE_0509, '2026-09-05', '15:00', 30);
  assert.equal(fit.ok, false);
  assert.match(fit.reason, /nao esta na grade/);
});

test('bookingFitsSlotWindow — snapshot vazio não bloqueia (expediente cobre o outro lado)', () => {
  const fit = bookingFitsSlotWindow([], '2026-09-05', '14:00', 120);
  assert.equal(fit.ok, true);
  assert.equal(fit.contiguousMinutes, null);
});

test('annotateStarts — quatro slots de 30min: 14:00 cabe 120min', () => {
  const starts = [
    new Date('2026-09-05T14:00:00-03:00'),
    new Date('2026-09-05T14:30:00-03:00'),
    new Date('2026-09-05T15:00:00-03:00'),
    new Date('2026-09-05T15:30:00-03:00'),
  ];
  const rows = annotateStarts(starts);
  assert.equal(rows[0].contiguousMinutes, 120);
  assert.equal(rows[1].contiguousMinutes, 90);
  assert.equal(bookingFitsSlotWindow(starts, '2026-09-05', '14:00', 120).ok, true);
  assert.equal(bookingFitsSlotWindow(starts, '2026-09-05', '14:30', 120).ok, false);
});
