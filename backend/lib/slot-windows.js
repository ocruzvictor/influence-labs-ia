/**
 * Janela contínua de slots Trinks: cada início livre anota quantos minutos
 * seguidos cabem até o próximo ocupado (grain típico 30 min).
 */

const DEFAULT_GRAIN_MIN = 30;
const MAX_GRAIN_MIN = 120;

function toStartMs(value) {
  let ms = null;
  if (value instanceof Date) ms = value.getTime();
  else {
    const d = new Date(value);
    ms = d.getTime();
  }
  if (ms == null || Number.isNaN(ms)) return null;
  return Math.floor(ms / 60000) * 60000;
}

function uniqueSortedMs(starts) {
  const set = new Set();
  for (const start of starts || []) {
    const ms = toStartMs(start);
    if (ms != null) set.add(ms);
  }
  return [...set].sort((a, b) => a - b);
}

function inferGrainMinutes(startsMs, fallback = DEFAULT_GRAIN_MIN) {
  if (!Array.isArray(startsMs) || startsMs.length < 2) return fallback;
  const diffs = [];
  for (let i = 1; i < startsMs.length; i += 1) {
    const delta = startsMs[i] - startsMs[i - 1];
    if (delta > 0) diffs.push(delta);
  }
  if (!diffs.length) return fallback;
  diffs.sort((a, b) => a - b);
  const medianMs = diffs[Math.floor(diffs.length / 2)];
  const minutes = Math.round(medianMs / 60000);
  if (minutes < 5 || minutes > MAX_GRAIN_MIN) return fallback;
  return minutes;
}

function contiguousMinutesFrom(startMs, startSet, grainMin) {
  const grain = Math.max(1, Number(grainMin) || DEFAULT_GRAIN_MIN);
  const grainMs = grain * 60000;
  let count = 0;
  let cursor = startMs;
  while (startSet.has(cursor) && count < 48) {
    count += 1;
    cursor += grainMs;
  }
  return count * grain;
}

function annotateStarts(starts, grainMin) {
  const startsMs = uniqueSortedMs(starts);
  const grain = grainMin || inferGrainMinutes(startsMs);
  const startSet = new Set(startsMs);
  return startsMs.map((ms) => ({
    startsAtMs: ms,
    contiguousMinutes: contiguousMinutesFrom(ms, startSet, grain),
    grainMinutes: grain,
  }));
}

function formatHhmm(ms, timeZone = 'America/Sao_Paulo') {
  return new Date(ms).toLocaleTimeString('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatAnnotatedTimes(starts, timeZone = 'America/Sao_Paulo') {
  return annotateStarts(starts)
    .map((row) => `${formatHhmm(row.startsAtMs, timeZone)} (${row.contiguousMinutes}min contínuos)`)
    .join(', ');
}

/**
 * O início cabe se a faixa contínua a partir dele for >= duração do serviço.
 * Sem starts (snapshot vazio) não bloqueia — o expediente continua sendo o outro gate.
 */
function bookingFitsSlotWindow(starts, dateStr, timeStr, durationMinutes = 0, grainMin) {
  const date = String(dateStr || '');
  const time = String(timeStr || '').slice(0, 5);
  const dur = Math.max(0, Number(durationMinutes) || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, reason: 'data/hora invalida', contiguousMinutes: 0 };
  }
  const startMs = toStartMs(`${date}T${time}:00-03:00`);
  if (startMs == null) return { ok: false, reason: 'data/hora invalida', contiguousMinutes: 0 };
  const startsMs = uniqueSortedMs(starts);
  if (!startsMs.length) {
    return { ok: true, reason: 'sem snapshot de slots — janela nao validada', contiguousMinutes: null };
  }
  const grain = grainMin || inferGrainMinutes(startsMs);
  const startSet = new Set(startsMs);
  if (!startSet.has(startMs)) {
    return { ok: false, reason: 'inicio nao esta na grade livre', contiguousMinutes: 0 };
  }
  const contiguousMinutes = contiguousMinutesFrom(startMs, startSet, grain);
  if (dur > 0 && contiguousMinutes < dur) {
    return {
      ok: false,
      reason: `janela continua ${contiguousMinutes}min < duracao ${dur}min`,
      contiguousMinutes,
    };
  }
  return { ok: true, reason: '', contiguousMinutes };
}

module.exports = {
  DEFAULT_GRAIN_MIN,
  inferGrainMinutes,
  contiguousMinutesFrom,
  annotateStarts,
  formatAnnotatedTimes,
  bookingFitsSlotWindow,
  uniqueSortedMs,
};
