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

/**
 * Skip CREATE só com duplicata ATIVA no snapshot.
 * `state.createKeys.has` sozinho NÃO skipa — cancel ops não limpa o Set da sessão (B1 / 0007).
 */
function shouldSkipCreateIdempotent({ duplicateRow } = {}) {
  return Boolean(duplicateRow);
}

function brtDateTimeFromIso(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { date, time: String(time || '').slice(0, 5) };
}

/** Remove a idemKey do slot cancelado. Cancel ops não chama isto — o skip consulta o snapshot. */
function forgetCreateKeyForAppointment(createKeys, { clientPhone, appointment } = {}) {
  if (!createKeys || typeof createKeys.delete !== 'function' || !appointment) return false;
  const dt = appointment.scheduled_at
    ? brtDateTimeFromIso(appointment.scheduled_at)
    : (appointment.date && appointment.time
      ? { date: String(appointment.date).slice(0, 10), time: String(appointment.time).slice(0, 5) }
      : null);
  if (!dt) return false;
  const key = createIdempotencyKey({
    clientPhone,
    serviceId: appointment.service_id,
    professionalId: appointment.professional_id,
    date: dt.date,
    time: dt.time,
  });
  const had = createKeys.has(key);
  createKeys.delete(key);
  return had;
}

function decideCreateIdempotency({ createKeys, bookingData, existingRows } = {}) {
  const booking = bookingData || {};
  const idemKey = createIdempotencyKey(booking);
  const sessionHasKey = Boolean(createKeys && typeof createKeys.has === 'function' && createKeys.has(idemKey));
  const duplicateRow = findDuplicateAppointment(existingRows, booking);
  const skip = shouldSkipCreateIdempotent({ sessionHasKey, duplicateRow });
  return { idemKey, sessionHasKey, duplicateRow, skip, wouldPost: !skip };
}

function parseCreateStartMs(create) {
  const dateTime = create?.date_time
    || (create?.date && create?.time ? `${create.date}T${String(create.time).slice(0, 5)}:00-03:00` : null);
  if (!dateTime) return null;
  const start = new Date(dateTime).getTime();
  return Number.isNaN(start) ? null : start;
}

function createDayKey(create) {
  if (create?.date) return String(create.date).slice(0, 10);
  if (create?.date_time) return String(create.date_time).slice(0, 10);
  return null;
}

/**
 * True se dois CREATEs no mesmo dia têm intervalos [start, start+dur) que se cruzam.
 * Sequência tocante (14:00–15:00 e 15:00–16:00) NÃO é overlap.
 */
function comboOverlaps(creates) {
  const items = (Array.isArray(creates) ? creates : []).map((create) => {
    const start = parseCreateStartMs(create);
    const duration = Number(create?.duration_minutes ?? create?.durationMinutes ?? 0);
    const day = createDayKey(create);
    if (start == null || !duration || duration <= 0 || !day) return null;
    return { start, end: start + duration * 60 * 1000, day };
  }).filter(Boolean);

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].day !== items[j].day) continue;
      if (items[i].start < items[j].end && items[j].start < items[i].end) return true;
    }
  }
  return false;
}

/**
 * Incompatível ganha de expediente: Dylan+Corte fora do horário ainda recebe copy de habilitação.
 * Count de SKU NÃO veta — overlap é `comboOverlaps` no caller.
 */
function pickCreateGuard({ compatible, expedienteFit, janelaFit, appointmentConflict }) {
  if (compatible === false) return { kind: 'incompatible' };
  if (appointmentConflict) {
    return { kind: 'ocupado', reason: appointmentConflict.reason || 'horario ocupado por outro cliente' };
  }
  if (expedienteFit && expedienteFit.ok === false) {
    return { kind: 'expediente', reason: expedienteFit.reason || '' };
  }
  if (janelaFit && janelaFit.ok === false) {
    return { kind: 'janela', reason: janelaFit.reason || '' };
  }
  return { kind: null };
}

/**
 * Formata data/hora para bolha 2-phase preferindo dataHoraInicio do POST 201.
 * Fallback: date/time da tag se o 201 omitir start.
 */
function formatDataFmtFrom201(bookingResult, bookingData) {
  const created = bookingResult?.data || bookingResult || {};
  const rawStart = created.dataHoraInicio || created.data_hora_inicio;
  if (rawStart) {
    const normalized = /T\d{2}:\d{2}/.test(String(rawStart))
      && !/[Z+-]\d{2}:?\d{2}$/.test(String(rawStart).slice(-6))
      ? `${rawStart}-03:00`
      : rawStart;
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) {
      const date = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const time = d.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${date} às ${time}`;
    }
  }
  if (bookingData?.date && bookingData?.time) {
    return `${bookingData.date.split('-').reverse().join('/')} às ${bookingData.time}`;
  }
  return 'no horario combinado';
}

/**
 * Nome do serviço gravado no POST 201 (SKU real), não o merge verbal de combo.
 */
function resolveServicoNomeFrom201(bookingResult, fallbackName) {
  const created = bookingResult?.data || bookingResult || {};
  return created.servico?.nome
    || created.nomeServico
    || created.servicoNome
    || fallbackName
    || '';
}

/**
 * Recheck P1.7: slot prof+start já tem appointment ativo de outro cliente.
 */
function findActiveAppointmentConflict(appointments, booking, { clientPhone } = {}) {
  const wantMs = scheduledAtMs(`${booking.date}T${String(booking.time || '').slice(0, 5)}:00-03:00`);
  if (wantMs == null) return null;
  const bookingPhone = String(clientPhone || booking.clientPhone || '').replace(/\D/g, '');
  for (const row of appointments || []) {
    if (!ACTIVE_STATUSES.has(String(row.status || ''))) continue;
    if (String(row.professional_id) !== String(booking.professionalId || '')) continue;
    const gotMs = scheduledAtMs(row.scheduled_at);
    if (gotMs == null || Math.abs(gotMs - wantMs) >= 60 * 1000) continue;
    const rowPhone = String(row.client_phone || '').replace(/\D/g, '');
    if (rowPhone && bookingPhone && rowPhone === bookingPhone) continue;
    return {
      reason: 'inicio ja ocupado por outro cliente',
      appointmentId: row.trinks_id,
    };
  }
  return null;
}

function buildCreateSuccessMessage({
  afterHours = false,
  dataFmt,
  servicoLinha = '',
  profNome,
  valorFmt,
}) {
  const opener = afterHours
    ? 'Registrei aqui. Como estamos fora do horário, a recepção confere logo cedo. Tá anotado 😊\n\n'
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
  shouldSkipCreateIdempotent,
  forgetCreateKeyForAppointment,
  decideCreateIdempotency,
  buildCreateSuccessMessage,
  pickCreateGuard,
  comboOverlaps,
  formatDataFmtFrom201,
  resolveServicoNomeFrom201,
  findActiveAppointmentConflict,
  ACTIVE_STATUSES,
};
