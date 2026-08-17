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
  MONTHS_PT,
};
