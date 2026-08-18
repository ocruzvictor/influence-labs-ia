/**
 * Guardas de create: idempotência e copy de sucesso (I.8).
 * Sem I/O — o caller consulta o snapshot local.
 */
const crypto = require('crypto');

const ACTIVE_STATUSES = new Set(['scheduled', 'confirmed']);

function createIdempotencyKey({ clientPhone, serviceId, professionalId, date, time }) {
  const raw = [
    String(clientPhone || '').replace(/\D/g, ''),
    String(serviceId || ''),
    String(professionalId || ''),
    String(date || ''),
    String(time || '').slice(0, 5),
  ].join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function scheduledAtMs(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function isDuplicateAppointment(row, booking) {
  if (!row || !ACTIVE_STATUSES.has(String(row.status || ''))) return false;
  if (String(row.service_id) !== String(booking.serviceId || '')) return false;
  if (String(row.professional_id) !== String(booking.professionalId || '')) return false;
  const got = scheduledAtMs(row.scheduled_at);
  const want = scheduledAtMs(`${booking.date}T${booking.time}:00-03:00`);
  if (got == null || want == null) return false;
  return Math.abs(got - want) < 60 * 1000;
}

function findDuplicateAppointment(rows, booking) {
  return (Array.isArray(rows) ? rows : []).find((row) => isDuplicateAppointment(row, booking)) || null;
}

function buildCreateSuccessMessage({
  afterHours = false,
  dataFmt,
  servicoLinha = '',
  profNome,
  valorFmt,
}) {
  const opener = afterHours
    ? 'Registrei aqui. Como estamos fora do horário, o Gabriel confere logo cedo. Tá anotado 😊\n\n'
    : 'Prontinho! Te esperamos no Studio Tirra 😊\n\n';
  return (
    opener +
    `📅 ${dataFmt}\n` +
    servicoLinha +
    `💇 com ${profNome}\n` +
    `💰 R$ ${valorFmt}\n\n` +
    `📍 R. Espírito Santo, 385 - Santo Antônio, São Caetano do Sul\n` +
    `🅿️ Estacionamento: subir rampa lateral\n\n` +
    `Qualquer coisa é só chamar! ✌🏻`
  );
}

module.exports = {
  createIdempotencyKey,
  findDuplicateAppointment,
  isDuplicateAppointment,
  buildCreateSuccessMessage,
  ACTIVE_STATUSES,
};
