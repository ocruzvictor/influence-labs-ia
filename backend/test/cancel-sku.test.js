/**
 * Unit tests — cancel só trinks_id (Story 9 / B2 smoke 0007).
 *   node --test backend/test/cancel-sku.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveCancelAgendamentoId,
  isKnownServiceSkuNotBookingId,
  isBookingOwnedByClient,
  selectOutboundBlocks,
  HONEST_CREATE_SKIP_COPY,
  HONEST_CANCEL_FAIL_COPY,
} = require('../lib/booking-parser');

const SKU_CORTE = '14232906';
const TRINKS_ID = '526039154';
const FUTURO_CORTE = {
  trinks_id: TRINKS_ID,
  service_id: SKU_CORTE,
  service_name: 'Corte Masculino',
  professional_id: '827200',
  scheduled_at: '2026-09-03T10:30:00-03:00',
};

test('0007-class B2 — tag SKU + 1 futuro mesmo service_id → PATCH só no trinks_id', () => {
  const resolved = resolveCancelAgendamentoId({
    cancelTag: { agendamento_id: Number(SKU_CORTE) },
    futureBookings: [FUTURO_CORTE],
    knownServiceIds: [Number(SKU_CORTE)],
  });
  assert.equal(resolved.agendamentoId, TRINKS_ID);
  assert.equal(resolved.reason, null);
  assert.notEqual(resolved.agendamentoId, SKU_CORTE);
  assert.equal(isBookingOwnedByClient(resolved.agendamentoId, [FUTURO_CORTE]), true);
});

test('0007-class B2 — tag SKU + 0 futuros → 0 PATCH no SKU', () => {
  const resolved = resolveCancelAgendamentoId({
    cancelTag: { agendamento_id: Number(SKU_CORTE) },
    futureBookings: [],
    knownServiceIds: [Number(SKU_CORTE)],
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'sku_not_booking');
  assert.equal(isKnownServiceSkuNotBookingId(SKU_CORTE, {
    knownServiceIds: [SKU_CORTE],
    futureBookings: [],
  }), true);
});

test('0007-class B2 — 2 futuros mesmo SKU → 0 PATCH (não list[0])', () => {
  const resolved = resolveCancelAgendamentoId({
    cancelTag: { agendamento_id: SKU_CORTE },
    futureBookings: [
      FUTURO_CORTE,
      { ...FUTURO_CORTE, trinks_id: '526039155', scheduled_at: '2026-09-04T10:30:00-03:00' },
    ],
    knownServiceIds: [SKU_CORTE],
  });
  assert.equal(resolved.agendamentoId, null);
  assert.equal(resolved.reason, 'sku_ambiguous');
});

test('0007-class B2 — trinks_id owned → PATCH nesse id', () => {
  const resolved = resolveCancelAgendamentoId({
    cancelTag: { agendamento_id: TRINKS_ID },
    futureBookings: [FUTURO_CORTE],
    knownServiceIds: [SKU_CORTE],
  });
  assert.equal(resolved.agendamentoId, TRINKS_ID);
});

test('8397-class — cancel successCount=0 usa copy de recusa, não Tess prematura', () => {
  const tessPremature = ['Cancelando seu horário agora...'];
  const blocks = selectOutboundBlocks({
    formattedResponses: tessPremature,
    finalMessages: [HONEST_CANCEL_FAIL_COPY],
    cancelsToRun: [{ agendamento_id: SKU_CORTE }],
    cancelSuccessCount: 0,
  });
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /Não consegui localizar\/cancelar/);
  assert.doesNotMatch(blocks[0], /Cancelando/);
});

test('8397-class — cancel failure sem blocos ainda retorna recusa honesta', () => {
  const blocks = selectOutboundBlocks({
    formattedResponses: [],
    finalMessages: [],
    cancelsToRun: [{ agendamento_id: SKU_CORTE }],
    cancelSuccessCount: 0,
  });
  assert.deepEqual(blocks, [HONEST_CANCEL_FAIL_COPY]);
});

test('8397-class — cancelamento parcial não mantém copy de sucesso total', () => {
  const blocks = selectOutboundBlocks({
    formattedResponses: ['Pronto, cancelei seus 2 horários!'],
    finalMessages: ['Consegui cancelar 1 de 2 horários. Vou pedir pra recepção resolver o restante com você.'],
    cancelsToRun: [{ agendamento_id: '526039154' }, { agendamento_id: '526039155' }],
    cancelSuccessCount: 1,
  });
  assert.deepEqual(blocks, ['Consegui cancelar 1 de 2 horários. Vou pedir pra recepção resolver o restante com você.']);
  assert.doesNotMatch(blocks.join('\n'), /cancelei seus 2 horários/i);
});

test('0007-class B1 — skip sem 2xx não deixa Confirmo aqui', () => {
  const blocks = selectOutboundBlocks({
    formattedResponses: ['Confirmo aqui o agendamento então'],
    finalMessages: [],
    createIdempotentSkip: true,
    bookingResult: null,
  });
  assert.equal(blocks.join('\n'), HONEST_CREATE_SKIP_COPY);
  assert.doesNotMatch(blocks.join('\n'), /Confirmo aqui/i);
});

test('0007-class B1 — cancel result não conta como booking.created', () => {
  const blocks = selectOutboundBlocks({
    formattedResponses: ['Confirmo aqui o agendamento então'],
    finalMessages: [],
    createIdempotentSkip: true,
    bookingCreatedThisTurn: false,
    bookingResult: { agendamentoId: TRINKS_ID, cancelado: true },
  });
  assert.equal(blocks.join('\n'), HONEST_CREATE_SKIP_COPY);
  assert.doesNotMatch(blocks.join('\n'), /Confirmo aqui/i);
});
