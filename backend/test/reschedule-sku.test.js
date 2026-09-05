/**
 * Unit tests — reschedule SKU Rosa bind (Story P0.6).
 *   node --test backend/test/reschedule-sku.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveRescheduleAgendamentoId,
  resolveCreateMoveLeftoverId,
  formatRescheduleRefusalMessage,
  serviceSkuMatches,
} = require('../lib/booking-parser');

const FUTURO_BARBA = {
  trinks_id: '9002185',
  service_name: 'Barba',
  professional_name: 'Erick',
  scheduled_at: '2026-09-04T15:00:00-03:00',
};

const FUTURO_CORTE = {
  trinks_id: '9000160',
  service_name: 'Corte Masculino',
  professional_name: 'Erick',
  scheduled_at: '2026-09-04T09:00:00-03:00',
};

test('2185-class — Rosa Corte, futuro Barba → 0 PUT (sku_mismatch)', () => {
  const tag = {
    service_name: 'Corte Masculino',
    service_id: 14129499,
    old_date: '2026-09-04',
    date_time: '2026-09-05T10:00:00-03:00',
    professional_id: 3,
  };
  const findResult = { id: FUTURO_BARBA.trinks_id, service_name: 'Barba' };
  const resolved = resolveRescheduleAgendamentoId({
    bookingReschedule: tag,
    futureBookings: [FUTURO_BARBA],
    findClientBookingResult: findResult,
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'sku_mismatch');
  assert.ok(!/reagendei/i.test(formatRescheduleRefusalMessage(resolved.reason)));
});

test('0160-class — Rosa Corte, findClientBooking devolve Barba → recusa', () => {
  const tag = {
    service_name: 'Corte Masculino',
    old_date: '2026-09-04',
    date_time: '2026-09-04T14:00:00-03:00',
    professional_id: 3,
  };
  const resolved = resolveRescheduleAgendamentoId({
    bookingReschedule: tag,
    futureBookings: [FUTURO_BARBA, FUTURO_CORTE],
    findClientBookingResult: { id: FUTURO_BARBA.trinks_id, service_name: 'Barba' },
  });
  assert.equal(resolved.agendamentoId, String(FUTURO_CORTE.trinks_id));
  assert.equal(resolved.reason, null);
});

test('rosa vazio → 0 PUT + recusa honesta', () => {
  const resolved = resolveRescheduleAgendamentoId({
    bookingReschedule: { service_name: 'Corte Masculino', old_date: '2026-09-04' },
    futureBookings: [],
    findClientBookingResult: null,
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'rosa_vazio');
  assert.match(formatRescheduleRefusalMessage(resolved.reason), /agenda/i);
});

test('SKU certo → resolve id do Rosa', () => {
  const resolved = resolveRescheduleAgendamentoId({
    bookingReschedule: {
      service_name: 'Corte Masculino',
      date_time: '2026-09-05T10:00:00-03:00',
    },
    futureBookings: [FUTURO_CORTE],
    findClientBookingResult: null,
  });
  assert.equal(resolved.agendamentoId, '9000160');
  assert.equal(resolved.reason, null);
});

test('serviceSkuMatches — Corte ≠ Barba', () => {
  assert.equal(serviceSkuMatches(FUTURO_BARBA, 'Corte Masculino', null), false);
  assert.equal(serviceSkuMatches(FUTURO_CORTE, 'Corte Masculino', null), true);
});

test('agendamento_id explícito com SKU errado → sku_mismatch', () => {
  const resolved = resolveRescheduleAgendamentoId({
    bookingReschedule: {
      agendamento_id: FUTURO_BARBA.trinks_id,
      service_name: 'Corte Masculino',
    },
    futureBookings: [FUTURO_BARBA],
    findClientBookingResult: null,
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'sku_mismatch');
});

// --- P1.1 Ana leftover (8528) ---
test('8528-class Q1 — Rosa manicure hoje + tag reschedule/move → resolve id antigo', () => {
  const FUTURO_MANICURE_HOJE = {
    trinks_id: '9008528',
    service_id: '14232900',
    service_name: 'Manicure',
    professional_id: '826936',
    scheduled_at: '2026-09-05T11:00:00-03:00',
  };
  const tag = {
    service_name: 'Manicure',
    service_id: '14232900',
    old_date: '2026-09-05',
    date_time: '2026-09-12T14:30:00-03:00',
    professional_id: '826936',
  };
  const resolved = resolveCreateMoveLeftoverId({
    bookingReschedule: tag,
    futureBookings: [FUTURO_MANICURE_HOJE],
    findClientBookingResult: null,
  });
  assert.equal(resolved.agendamentoId, '9008528');
  assert.equal(resolved.reason, null);
});

test('8528-class Q1 — not_owned recusado', () => {
  const resolved = resolveCreateMoveLeftoverId({
    bookingReschedule: { agendamento_id: '9999999', service_name: 'Manicure' },
    futureBookings: [{ trinks_id: '9008528', service_name: 'Manicure', service_id: '14232900' }],
    findClientBookingResult: null,
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'not_owned');
});

test('8528-class Q1 — sem tag reschedule → no_reschedule_tag', () => {
  const resolved = resolveCreateMoveLeftoverId({
    bookingReschedule: null,
    futureBookings: [],
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'no_reschedule_tag');
});
