const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createIdempotencyKey,
  findDuplicateAppointment,
  buildCreateSuccessMessage,
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
  assert.match(closed, /Gabriel confere logo cedo/);
});
