/**
 * Datas do salão (America/Sao_Paulo): dias úteis e parse da data pedida pelo cliente.
 * Sem REST — só calendário. Usado para decidir quais snapshots locais injetar.
 */

const MONTHS_PT = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, março: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

function addDaysToIsoDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function isValidIsoDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function toIso(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

function getNextBusinessDays(count, startIso) {
  const n = Math.max(0, Number(count) || 0);
  const dates = [];
  let cursor = startIso;
  while (dates.length < n) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 1) dates.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dates;
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SALON_TIME_ZONE = 'America/Sao_Paulo';

function getTimePartsInSalonTimeZone(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (t) => parts.find((p) => p.type === t)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: parseInt(pick('hour'), 10),
    minute: parseInt(pick('minute'), 10),
    weekday: weekdayMap[pick('weekday')] ?? 0,
  };
}

/**
 * Politica: Ter-Sex 9h-19h · Sab 9h-18h · Dom/Seg fechado.
 * hour < close → ainda aberto (19:00 sexta já é fechado).
 */
function isSalonOpen(date = new Date()) {
  const { hour, minute, weekday } = getTimePartsInSalonTimeZone(date);
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  let open = false;
  let reason = '';
  if (weekday === 0) reason = 'DOMINGO — salao fechado';
  else if (weekday === 1) reason = 'SEGUNDA — salao fechado';
  else if (weekday === 6) {
    if (hour >= 9 && hour < 18) open = true;
    else reason = hour < 9 ? 'SABADO antes das 9h' : 'SABADO depois das 18h';
  } else if (hour >= 9 && hour < 19) open = true;
  else reason = hour < 9 ? 'antes das 9h' : 'depois das 19h';
  return { open, hhmm, reason, weekday, minute };
}

function closingHourForWeekday(weekday) {
  if (weekday === 0 || weekday === 1) return null;
  if (weekday === 6) return 18;
  return 19;
}

/**
 * Inicio precisa estar aberto e inicio+duracao nao pode passar do fechamento do mesmo dia.
 */
function bookingFitsExpediente(dateStr, timeStr, durationMinutes = 0) {
  const date = String(dateStr || '');
  const time = String(timeStr || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, reason: 'data/hora invalida' };
  }
  const start = new Date(`${date}T${time}:00-03:00`);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: 'data/hora invalida' };
  const openState = isSalonOpen(start);
  if (!openState.open) return { ok: false, reason: openState.reason };
  const dur = Math.max(0, Number(durationMinutes) || 0);
  const end = new Date(start.getTime() + dur * 60000);
  const startParts = getTimePartsInSalonTimeZone(start);
  const endParts = getTimePartsInSalonTimeZone(end);
  const closeH = closingHourForWeekday(startParts.weekday);
  if (closeH == null) return { ok: false, reason: openState.reason };
  const crossedDay = endParts.weekday !== startParts.weekday
    && (endParts.hour > 0 || endParts.minute > 0);
  if (crossedDay) return { ok: false, reason: 'ultrapassa o fechamento' };
  const endMinutes = endParts.hour * 60 + endParts.minute;
  if (endMinutes > closeH * 60) return { ok: false, reason: 'ultrapassa o fechamento' };
  return { ok: true, reason: '' };
}

/**
 * Extrai uma data ISO da mensagem do cliente.
 * Aceita: 2026-08-25, 25/08/2026, 25/08, "25 de agosto", "25 de agosto de 2026".
 */
function extractRequestedDate(text, now = new Date()) {
  const value = String(text || '');
  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso && isValidIsoDate(iso[1])) return iso[1];

  const br = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (br) {
    const year = Number(br[3] || new Intl.DateTimeFormat('en', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    }).format(now));
    const candidate = toIso(year, Number(br[2]), Number(br[1]));
    if (!candidate) return null;
    if (!br[3]) {
      const parsed = new Date(`${candidate}T12:00:00-03:00`);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < now.getTime() - 86400000) {
        return toIso(year + 1, Number(br[2]), Number(br[1]));
      }
    }
    return candidate;
  }

  const normalized = stripAccents(value).toLowerCase();
  const pt = normalized.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(20\d{2}))?\b/);
  if (!pt) return null;
  const month = MONTHS_PT[pt[2]];
  if (!month) return null;
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const pick = (type) => Number(nowParts.find((part) => part.type === type)?.value);
  const year = Number(pt[3] || pick('year'));
  const candidate = toIso(year, month, Number(pt[1]));
  if (!candidate) return null;
  if (!pt[3]) {
    const parsed = new Date(`${candidate}T12:00:00-03:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < now.getTime() - 86400000) {
      return toIso(year + 1, month, Number(pt[1]));
    }
  }
  return candidate;
}

module.exports = {
  addDaysToIsoDate,
  getNextBusinessDays,
  extractRequestedDate,
  isValidIsoDate,
  isSalonOpen,
  bookingFitsExpediente,
  getTimePartsInSalonTimeZone,
  MONTHS_PT,
};
