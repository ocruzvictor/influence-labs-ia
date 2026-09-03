const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createIdempotencyKey,
  findDuplicateAppointment,
  buildCreateSuccessMessage,
  pickCreateGuard,
  comboOverlaps,
  formatDataFmtFrom201,
  resolveServicoNomeFrom201,
  findActiveAppointmentConflict,
} = require('../lib/booking-guards');

const booking = {
  clientPhone: '+55 18 99824-0447',
  serviceId: 12,
  professionalId: 3,
  date: '2026-08-21',
  time: '19:30',
};

test('createIdempotencyKey é estável e ignora formatação do telefone', () => {
  const a = createIdempotencyKey(booking);
  const b = createIdempotencyKey({ ...booking, clientPhone: '5518998240447' });
  assert.equal(a, b);
  assert.equal(a.length, 40);
});

test('findDuplicateAppointment casa scheduled+confirmed no mesmo slot', () => {
  const rows = [
    {
      status: 'scheduled',
      service_id: 12,
      professional_id: 3,
      scheduled_at: '2026-08-21T19:30:00-03:00',
    },
  ];
  assert.ok(findDuplicateAppointment(rows, booking));
});

test('findDuplicateAppointment ignora cancelado e slot diferente', () => {
  const rows = [
    {
      status: 'cancelled',
      service_id: 12,
      professional_id: 3,
      scheduled_at: '2026-08-21T19:30:00-03:00',
    },
    {
      status: 'confirmed',
      service_id: 12,
      professional_id: 3,
      scheduled_at: '2026-08-21T10:00:00-03:00',
    },
  ];
  assert.equal(findDuplicateAppointment(rows, booking), null);
});

test('buildCreateSuccessMessage — I.8: "Te esperamos" só dentro do horário', () => {
  const open = buildCreateSuccessMessage({
    afterHours: false,
    dataFmt: '21/08/2026 às 10:30',
    servicoLinha: '💅 Corte\n',
    profNome: 'Erick',
    valorFmt: '85,00',
  });
  const closed = buildCreateSuccessMessage({
    afterHours: true,
    dataFmt: '21/08/2026 às 10:30',
    servicoLinha: '💅 Corte\n',
    profNome: 'Erick',
    valorFmt: '85,00',
  });
  assert.match(open, /Te esperamos no Studio Tirra/);
  assert.doesNotMatch(closed, /Te esperamos/);
  assert.match(closed, /recepção confere logo cedo/);
});

test('pickCreateGuard — incompatível ganha de expediente (Dylan+Corte 19h)', () => {
  const guard = pickCreateGuard({
    compatible: false,
    expedienteFit: { ok: false, reason: 'depois das 19h' },
  });
  assert.equal(guard.kind, 'incompatible');
});

test('pickCreateGuard — compatível fora do expediente', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: false, reason: 'depois das 19h' },
  });
  assert.equal(guard.kind, 'expediente');
  assert.equal(guard.reason, 'depois das 19h');
});

test('pickCreateGuard — ambos ok → null', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: true, reason: '' },
    janelaFit: { ok: true, reason: '' },
  });
  assert.equal(guard.kind, null);
});

test('pickCreateGuard — janela contínua menor que a duração', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: true, reason: '' },
    janelaFit: { ok: false, reason: 'janela continua 60min < duracao 120min' },
  });
  assert.equal(guard.kind, 'janela');
  assert.match(guard.reason, /60min/);
});

test('pickCreateGuard — expediente ganha de janela', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: false, reason: 'depois das 19h' },
    janelaFit: { ok: false, reason: 'janela continua 30min < duracao 60min' },
  });
  assert.equal(guard.kind, 'expediente');
});

test('pickCreateGuard — 2+ SKUs não viram veto cego', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: true, reason: '' },
    janelaFit: { ok: true, reason: '' },
    distinctServiceCount: 2,
  });
  assert.equal(guard.kind, null);
});

test('pickCreateGuard — incompatível ganha mesmo com 2+ SKUs', () => {
  const guard = pickCreateGuard({
    compatible: false,
    expedienteFit: { ok: false, reason: 'depois das 19h' },
    distinctServiceCount: 3,
  });
  assert.equal(guard.kind, 'incompatible');
});

test('comboOverlaps — sequência tocante no mesmo dia não overlap', () => {
  assert.equal(comboOverlaps([
    { date_time: '2026-09-05T14:00:00-03:00', duration_minutes: 60 },
    { date_time: '2026-09-05T15:00:00-03:00', duration_minutes: 45 },
  ]), false);
});

test('comboOverlaps — mesmo início é overlap', () => {
  assert.equal(comboOverlaps([
    { date_time: '2026-09-05T14:00:00-03:00', duration_minutes: 60 },
    { date_time: '2026-09-05T14:00:00-03:00', duration_minutes: 30 },
  ]), true);
});

test('comboOverlaps — janelas que se cruzam', () => {
  assert.equal(comboOverlaps([
    { date: '2026-09-05', time: '14:00', durationMinutes: 90 },
    { date: '2026-09-05', time: '15:00', duration_minutes: 60 },
  ]), true);
});

test('comboOverlaps — dias diferentes não overlap', () => {
  assert.equal(comboOverlaps([
    { date_time: '2026-09-05T14:00:00-03:00', duration_minutes: 120 },
    { date_time: '2026-09-06T14:00:00-03:00', duration_minutes: 120 },
  ]), false);
});

test('formatDataFmtFrom201 — 5718: POST 201 15:00 prevalece sobre tag 15:30', () => {
  const bookingResult = { data: { dataHoraInicio: '2026-09-02T15:00:00' } };
  const bookingData = { date: '2026-09-02', time: '15:30' };
  const fmt = formatDataFmtFrom201(bookingResult, bookingData);
  assert.match(fmt, /15:00/);
  assert.doesNotMatch(fmt, /15:30/);
});

test('formatDataFmtFrom201 — fallback tag quando 201 omite start', () => {
  const fmt = formatDataFmtFrom201({}, { date: '2026-09-02', time: '14:30' });
  assert.match(fmt, /02\/09\/2026 às 14:30/);
});

test('resolveServicoNomeFrom201 — só SKU do 201 (franja, não combo verbal)', () => {
  const name = resolveServicoNomeFrom201(
    { data: { servico: { nome: 'Corte de franja' } } },
    'Corte de franja + Escova',
  );
  assert.equal(name, 'Corte de franja');
});

test('findActiveAppointmentConflict — 9605: Fefe 09:00 ocupada por outro cliente', () => {
  const rows = [{
    status: 'confirmed',
    professional_id: '826936',
    scheduled_at: '2026-09-03T09:00:00-03:00',
    client_phone: '5511999999999',
    trinks_id: '14129517',
  }];
  const booking = { professionalId: '826936', date: '2026-09-03', time: '09:00' };
  const conflict = findActiveAppointmentConflict(rows, booking, { clientPhone: '5511888888888' });
  assert.ok(conflict);
  assert.match(conflict.reason, /ocupado/);
});

test('findActiveAppointmentConflict — mesmo cliente no slot → sem conflito', () => {
  const rows = [{
    status: 'scheduled',
    professional_id: '826936',
    scheduled_at: '2026-09-03T09:00:00-03:00',
    client_phone: '5511888888888',
  }];
  const booking = { professionalId: '826936', date: '2026-09-03', time: '09:00' };
  assert.equal(findActiveAppointmentConflict(rows, booking, { clientPhone: '5511888888888' }), null);
});

test('pickCreateGuard — appointmentConflict → ocupado', () => {
  const guard = pickCreateGuard({
    compatible: true,
    expedienteFit: { ok: true },
    janelaFit: { ok: true },
    appointmentConflict: { reason: 'inicio ja ocupado por outro cliente' },
  });
  assert.equal(guard.kind, 'ocupado');
});

test('0007-class B1 — createKeys no Set + row cancelled → POST de novo (não skip)', () => {
  const { decideCreateIdempotency, createIdempotencyKey } = require('../lib/booking-guards');
  const booking0007 = {
    clientPhone: '5511999900007',
    serviceId: 14232906,
    professionalId: 827200,
    date: '2026-09-03',
    time: '10:30',
  };
  const idemKey = createIdempotencyKey(booking0007);
  const createKeys = new Set([idemKey]);
  const cancelledOnly = [{
    status: 'cancelled',
    service_id: 14232906,
    professional_id: 827200,
    scheduled_at: '2026-09-03T10:30:00-03:00',
    trinks_id: '526039154',
  }];
  const decision = decideCreateIdempotency({
    createKeys,
    bookingData: booking0007,
    existingRows: cancelledOnly,
  });
  assert.equal(decision.sessionHasKey, true);
  assert.equal(decision.skip, false);
  assert.equal(decision.wouldPost, true);
  assert.equal(decision.duplicateRow, null);
});

test('0007-class B1 — duplicata ativa real ainda skipa', () => {
  const { decideCreateIdempotency } = require('../lib/booking-guards');
  const booking0007 = {
    clientPhone: '5511999900007',
    serviceId: 14232906,
    professionalId: 827200,
    date: '2026-09-03',
    time: '10:30',
  };
  const createKeys = new Set();
  const active = [{
    status: 'scheduled',
    service_id: 14232906,
    professional_id: 827200,
    scheduled_at: '2026-09-03T10:30:00-03:00',
    trinks_id: '526039154',
  }];
  const decision = decideCreateIdempotency({
    createKeys,
    bookingData: booking0007,
    existingRows: active,
  });
  assert.equal(decision.skip, true);
  assert.equal(decision.wouldPost, false);
});

test('0007-class B1 — cancel 4b esquece a idemKey do slot', () => {
  const {
    createIdempotencyKey,
    forgetCreateKeyForAppointment,
  } = require('../lib/booking-guards');
  const booking0007 = {
    clientPhone: '5511999900007',
    serviceId: 14232906,
    professionalId: 827200,
    date: '2026-09-03',
    time: '10:30',
  };
  const key = createIdempotencyKey(booking0007);
  const createKeys = new Set([key]);
  const dropped = forgetCreateKeyForAppointment(createKeys, {
    clientPhone: booking0007.clientPhone,
    appointment: {
      service_id: 14232906,
      professional_id: 827200,
      scheduled_at: '2026-09-03T10:30:00-03:00',
    },
  });
  assert.equal(dropped, true);
  assert.equal(createKeys.has(key), false);
});
