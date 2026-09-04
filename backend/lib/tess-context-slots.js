/**
 * Oferta consultiva de slots — compactação scoped BOOKING (sem TESS).
 */

const { annotateStarts, formatAnnotatedTimes, formatPickedAnnotatedTimes, uniqueSortedMs } = require('./slot-windows');
const { normalizeText, PROFESSIONAL_RE, isDurationHourToken } = require('./tess-context-intent');
const {
  filterServicesByKeywords,
  applyGenderQualifier,
  detectGenderQualifier,
} = require('./booking-parser');

const SALON_TZ = 'America/Sao_Paulo';
const MORNING_RE = /\b(manha|manhã|cedo|de manha|de manhã|antes do almoco|antes do almoço)\b/i;
const AFTERNOON_RE = /\b(tarde|de tarde|depois do almoco|depois do almoço|a tarde|à tarde)\b/i;
const CLOCK_RE = /\b(\d{1,2})(?:(?::(\d{2}))|\s*h)\b/g;

/**
 * @returns {'morning'|'afternoon'|null}
 */
function detectPeriod(text) {
  const norm = normalizeText(text);
  if (!norm) return null;

  if (MORNING_RE.test(norm) && !AFTERNOON_RE.test(norm)) return 'morning';
  if (AFTERNOON_RE.test(norm) && !MORNING_RE.test(norm)) return 'afternoon';
  if (MORNING_RE.test(norm) && AFTERNOON_RE.test(norm)) return null;

  let morningClock = false;
  let afternoonClock = false;

  const hMinRe = /\b(\d{1,2})h(\d{2})\b/g;
  let hm;
  while ((hm = hMinRe.exec(norm)) !== null) {
    const hour = parseInt(hm[1], 10);
    if (hour >= 8 && hour <= 12) morningClock = true;
    if (hour >= 13 && hour <= 19) afternoonClock = true;
  }

  let match;
  const re = new RegExp(CLOCK_RE.source, 'gi');
  while ((match = re.exec(norm)) !== null) {
    const hour = parseInt(match[1], 10);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) continue;
    if (hour >= 8 && hour <= 12) morningClock = true;
    if (hour >= 13 && hour <= 19) afternoonClock = true;
    if (hour === 12 && match[2]) {
      const min = parseInt(match[2], 10);
      if (min === 0) morningClock = true;
    }
  }
  if (morningClock && !afternoonClock) return 'morning';
  if (afternoonClock && !morningClock) return 'afternoon';
  return null;
}

/**
 * @returns {{ hour: number, minute: number }|null}
 */
function detectExactClock(text) {
  const norm = normalizeText(text);
  if (!norm) return null;

  const patterns = [
    /\b(\d{1,2}):(\d{2})\b/g,
    /\b(\d{1,2})\s*h\b/g,
    /\b(\d{1,2})h(\d{2})\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(norm)) !== null) {
      if (isDurationHourToken(norm, m.index)) continue;
      const hour = parseInt(m[1], 10);
      let minute = 0;
      if (m[2] != null && re.source.includes(':')) {
        minute = parseInt(m[2], 10);
      } else if (m[2] != null && /h\d{2}/.test(m[0])) {
        minute = parseInt(m[2], 10);
      }
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }
  }
  return null;
}

function detectNamedProfessionals(text) {
  const norm = normalizeText(text);
  if (!norm || !PROFESSIONAL_RE.test(norm)) return [];
  const found = new Set();
  const re = new RegExp(PROFESSIONAL_RE.source, 'gi');
  let m;
  while ((m = re.exec(norm)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

function profNameMatchesToken(profName, token) {
  const n = normalizeText(profName);
  const t = normalizeText(token);
  if (!n || !t) return false;
  if (n.includes(t) || t.includes(n)) return true;
  const aliases = {
    andre: ['andré'],
    fernanda: ['fefe'],
    giovanna: ['gi'],
    bruna: ['bruuna'],
    claudia: ['cláudia'],
    jaqueline: ['jackie', 'jacki', 'jaque'],
    kamila: ['camila'],
    erick: ['erik', 'eric'],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    if (t === key || vals.includes(t)) {
      if (n.includes(key) || vals.some((v) => n.includes(normalizeText(v)))) return true;
    }
  }
  return false;
}

function filterProfessionals(professionals, mentionedTokens) {
  if (!mentionedTokens?.length) return professionals;
  return professionals.filter((p) =>
    mentionedTokens.some((tok) => profNameMatchesToken(p.name, tok)),
  );
}

function filterByAllowedNames(professionals, allowedNames) {
  if (!Array.isArray(professionals)) return [];
  if (!allowedNames?.length) return professionals;
  return professionals.filter((p) =>
    allowedNames.some((name) => profNameMatchesToken(p.name, name)),
  );
}

function slotLocalHour(startsAt, timeZone = SALON_TZ) {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

/**
 * morning: hour < 13; afternoon: hour >= 13 (almoço salão).
 */
function classifySlotPeriod(startsAt, timeZone = SALON_TZ) {
  const local = slotLocalHour(startsAt, timeZone);
  if (!local) return null;
  return local.hour < 13 ? 'morning' : 'afternoon';
}

function splitStartsByPeriod(startsAt, timeZone = SALON_TZ) {
  const morning = [];
  const afternoon = [];
  for (const s of startsAt || []) {
    const period = classifySlotPeriod(s, timeZone);
    if (period === 'morning') morning.push(s);
    else if (period === 'afternoon') afternoon.push(s);
  }
  return { morning, afternoon };
}

function hasPeriodSlots(startsAt, period, timeZone = SALON_TZ) {
  const split = splitStartsByPeriod(startsAt, timeZone);
  return (split[period] || []).length > 0;
}

function periodOccupancyLine(profName, startsAt, period, timeZone = SALON_TZ) {
  if (!hasPeriodSlots(startsAt, period, timeZone)) return null;
  if (period === 'morning') return `- ${profName}: há vagas de manhã.`;
  return `- ${profName}: há vagas de tarde.`;
}

function pickNearestStart(starts, targetMinutes) {
  const msList = uniqueSortedMs(starts);
  if (!msList.length) return null;
  let bestMs = msList[0];
  let bestDelta = Infinity;
  for (const ms of msList) {
    const local = slotLocalHour(new Date(ms).toISOString(), SALON_TZ);
    if (!local) continue;
    const delta = Math.abs(local.totalMinutes - targetMinutes);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestMs = ms;
    }
  }
  for (const s of starts) {
    if (uniqueSortedMs([s])[0] === bestMs) return s;
  }
  return new Date(bestMs).toISOString();
}

const ASK_TIMES_RE = /\b(quais?( os)? horarios?|horarios? disponiveis|que horas( tem| voces)?)\b/;

function asksForClockList(text) {
  return ASK_TIMES_RE.test(normalizeText(text));
}

const DURATION_HOUR_PATTERNS = [
  /\b(\d{1,2})\s*h\s+(de\s+)?(atendimento|duracao|servico|sessao)\b/g,
  /\b(leva|demora|dura[m]?|sao|são)\s+(\d{1,2})\s*h\b/g,
];

function extractSpeechDurationMin(text) {
  const norm = normalizeText(text);
  if (!norm) return 0;

  const direct = DURATION_HOUR_PATTERNS[0];
  direct.lastIndex = 0;
  let match = direct.exec(norm);
  if (match) {
    const hours = parseInt(match[1], 10);
    if (hours > 0) return hours * 60;
  }

  const verb = DURATION_HOUR_PATTERNS[1];
  verb.lastIndex = 0;
  match = verb.exec(norm);
  if (match) {
    const hours = parseInt(match[2], 10);
    if (hours > 0) return hours * 60;
  }
  return 0;
}

function skuDurationFrom(services) {
  if (!Array.isArray(services) || !services.length) return 0;
  const durs = services
    .map((s) => Number(s?.duracaoEmMinutos ?? s?.duration_min ?? 0))
    .filter((n) => n > 0);
  if (!durs.length) return 0;
  if (services.length <= 3) return Math.max(...durs);
  const unique = [...new Set(durs)];
  if (unique.length === 1) return unique[0];
  return 0;
}

/** Narrow catalog for duration when fala cita serviço (ex. cortar → família corte). */
function narrowServicesForOfferDuration(services, messageText, genderQualifier = null) {
  if (!Array.isArray(services) || !services.length || !messageText) return services;
  const gq = genderQualifier || detectGenderQualifier(messageText);
  const narrowed = filterServicesByKeywords(services, messageText, { genderQualifier: gq });
  if (!narrowed?.length) return services;
  return gq ? applyGenderQualifier(narrowed, gq) : narrowed;
}

function maxSkuDuration(services) {
  if (!Array.isArray(services) || !services.length) return 0;
  const durs = services
    .map((s) => Number(s?.duracaoEmMinutos ?? s?.duration_min ?? 0))
    .filter((n) => n > 0);
  return durs.length ? Math.max(...durs) : 0;
}

function minSkuDuration(services) {
  if (!Array.isArray(services) || !services.length) return 0;
  const durs = services
    .map((s) => Number(s?.duracaoEmMinutos ?? s?.duration_min ?? 0))
    .filter((n) => n > 0);
  return durs.length ? Math.min(...durs) : 0;
}

function resolveOfferDurationMin(services, opts) {
  const pool = opts?.messageText
    ? narrowServicesForOfferDuration(services, opts.messageText, opts.genderQualifier)
    : services;
  if (!opts?.messageText) {
    return skuDurationFrom(pool);
  }
  const speech = extractSpeechDurationMin(opts.messageText);
  let sku = skuDurationFrom(pool);
  if (pool !== services && pool?.length) {
    const minD = minSkuDuration(pool);
    const maxD = maxSkuDuration(pool);
    if (minD !== maxD) sku = minD;
    else if (!sku) sku = minD;
  }
  if (speech && sku) return Math.max(speech, sku);
  return speech || sku;
}

function startsFittingDuration(starts, durationMin) {
  const dur = Math.max(0, Number(durationMin) || 0);
  if (!dur) return starts || [];
  const okMs = new Set(
    annotateStarts(starts)
      .filter((row) => row.contiguousMinutes >= dur)
      .map((row) => row.startsAtMs),
  );
  return (starts || []).filter((s) => okMs.has(uniqueSortedMs([s])[0]));
}

function pickStartsForOffer(startsAt, period, maxCount, exactClock, durationMin, timeZone = SALON_TZ) {
  const fitting = startsFittingDuration(startsAt, durationMin);
  if (period) {
    return pickStartsForPeriod(fitting, period, maxCount, exactClock, timeZone);
  }
  const selected = [];
  const seen = new Set();
  const pushStart = (start) => {
    if (!start || selected.length >= maxCount) return;
    const ms = uniqueSortedMs([start])[0];
    if (ms == null || seen.has(ms)) return;
    seen.add(ms);
    selected.push(start);
  };
  if (exactClock) {
    pushStart(pickNearestStart(fitting, exactClock.hour * 60 + exactClock.minute));
  }
  for (const start of pickStartsForPeriod(fitting, 'morning', 1, null, timeZone)) pushStart(start);
  for (const start of pickStartsForPeriod(fitting, 'afternoon', 1, null, timeZone)) pushStart(start);
  if (selected.length < maxCount) {
    for (const ms of uniqueSortedMs(fitting)) {
      if (selected.length >= maxCount) break;
      if (seen.has(ms)) continue;
      seen.add(ms);
      selected.push(new Date(ms).toISOString());
    }
  }
  return selected.slice(0, maxCount);
}

function pickStartsForPeriod(startsAt, period, maxCount, exactClock, timeZone = SALON_TZ) {
  const split = splitStartsByPeriod(startsAt, timeZone);
  let pool = [...(split[period] || [])];
  if (!pool.length) return [];

  const selected = [];
  if (exactClock) {
    const targetMin = exactClock.hour * 60 + exactClock.minute;
    const nearest = pickNearestStart(pool, targetMin);
    if (nearest) {
      selected.push(nearest);
      pool = pool.filter((s) => uniqueSortedMs([s])[0] !== uniqueSortedMs([nearest])[0]);
    }
  }

  const msSelected = new Set(selected.map((s) => uniqueSortedMs([s])[0]));
  const remaining = uniqueSortedMs(pool).filter((ms) => !msSelected.has(ms));
  for (const ms of remaining) {
    if (selected.length >= maxCount) break;
    selected.push(new Date(ms).toISOString());
  }
  return selected.slice(0, maxCount);
}

function occupancyLine(profName, startsAt, timeZone = SALON_TZ) {
  const hasMorning = hasPeriodSlots(startsAt, 'morning', timeZone);
  const hasAfternoon = hasPeriodSlots(startsAt, 'afternoon', timeZone);
  if (!hasMorning && !hasAfternoon) return null;
  if (hasMorning && hasAfternoon) {
    return `- ${profName}: há vagas de manhã e de tarde.`;
  }
  if (hasMorning) return `- ${profName}: há vagas de manhã.`;
  return `- ${profName}: há vagas de tarde.`;
}

function occupancyLineForOffer(profName, startsAt, durationMin, timeZone = SALON_TZ) {
  const pool = durationMin > 0 ? startsFittingDuration(startsAt, durationMin) : startsAt;
  if (durationMin > 0 && !pool.length) {
    return `- ${profName}: sem janela contínua de ${durationMin}min neste dia.`;
  }
  return occupancyLine(profName, pool, timeZone);
}

function periodOccupancyLineForOffer(profName, startsAt, period, durationMin, timeZone = SALON_TZ) {
  const pool = durationMin > 0 ? startsFittingDuration(startsAt, durationMin) : startsAt;
  if (durationMin > 0 && !pool.length) {
    return `- ${profName}: sem janela contínua de ${durationMin}min neste dia.`;
  }
  return periodOccupancyLine(profName, pool, period, timeZone);
}

/**
 * Remove starts_at que caem dentro de [scheduled_at, scheduled_at+duration).
 */
function subtractOccupiedSlotStarts(professionals, appointments) {
  const apptsByProf = new Map();
  for (const appt of appointments || []) {
    const key = String(appt.professional_id);
    if (!apptsByProf.has(key)) apptsByProf.set(key, []);
    apptsByProf.get(key).push(appt);
  }

  let subtractedOccupied = 0;
  const nextProfessionals = (professionals || []).map((prof) => {
    const profAppts = apptsByProf.get(String(prof.professionalId)) || [];
    const kept = [];
    for (const startsAt of prof.startsAt || []) {
      const startMs = new Date(startsAt).getTime();
      if (Number.isNaN(startMs)) continue;
      let occupied = false;
      for (const appt of profAppts) {
        const apptStart = new Date(appt.scheduled_at).getTime();
        if (Number.isNaN(apptStart)) continue;
        const dur = Math.max(Number(appt.duration_min) || 30, 1);
        const apptEnd = apptStart + dur * 60000;
        if (startMs >= apptStart && startMs < apptEnd) {
          occupied = true;
          subtractedOccupied += 1;
          break;
        }
      }
      if (!occupied) kept.push(startsAt);
    }
    return { ...prof, startsAt: kept };
  }).filter((prof) => prof.startsAt.length > 0);

  return { professionals: nextProfessionals, subtractedOccupied };
}

const CLOCK_HONESTY_FOOTER = [
  'Só ofereça os inícios listados (grade real Trinks).',
  'Só ofereça se duracaoMinutos ≤ minutos contínuos anotados.',
  'Não some janelas nem invente horário. Se o cliente pedir um horário que não está aqui, diga que não cabe e ofereça 1 alternativa listada ou HANDOFF_HUMAN motivo=encaixe.',
].join(' ');

const SNAPSHOT_STALE_OFFER_MIN = 45;

function shouldEmitSnapshotOffer(contextProfile, horariosBlock) {
  return contextProfile === 'BOOKING'
    && typeof horariosBlock === 'string'
    && horariosBlock.includes('HORARIOS VAGOS');
}

function buildSnapshotOfferEventPayload({
  snapshotAgeMin,
  staleAfterMin = SNAPSHOT_STALE_OFFER_MIN,
  refreshed = false,
  subtractedOccupied = 0,
  traceId = null,
}) {
  return {
    event: 'snapshot.offer',
    payload: {
      snapshot_age_min: snapshotAgeMin,
      stale_after_min: staleAfterMin,
      refreshed: Boolean(refreshed),
      subtracted_occupied: Number(subtractedOccupied) || 0,
      trace_id: traceId || null,
    },
  };
}

/**
 * Agrupa slots abertos por profissional (estrutura testável).
 */
function groupOpenSlots(openSlots, professionalNames, skipSlotFn = () => false) {
  const grouped = new Map();
  for (const slot of openSlots || []) {
    const key = String(slot.professional_id);
    const profName = professionalNames.get(key) || '';
    if (skipSlotFn(profName, slot.starts_at)) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: profName || `Profissional ${key}`,
        professionalId: key,
        startsAt: [],
      });
    }
    grouped.get(key).startsAt.push(slot.starts_at);
  }
  return [...grouped.values()].filter((p) => p.startsAt.length > 0);
}

function formatFullSlotsBlock(label, professionals) {
  if (!professionals?.length) {
    return `HORARIOS VAGOS ${label}:\n- Nenhum horario disponivel no snapshot local.`;
  }
  const lines = [];
  for (const prof of professionals) {
    const times = formatAnnotatedTimes(prof.startsAt);
    if (!times) continue;
    lines.push(`- ${prof.name}: ${times}`);
  }
  if (!lines.length) {
    return `HORARIOS VAGOS ${label}:\n- Nenhum horario disponivel no snapshot local.`;
  }
  return [
    `HORARIOS VAGOS ${label} (início livre; só ofereça se duracaoMinutos ≤ minutos contínuos; o serviço também precisa terminar antes do fechamento Ter-Sex 9h-19h / Sáb 9h-18h):`,
    ...lines,
  ].join('\n');
}

const CONSULTIVA_FOOTER = [
  'NÃO liste horários neste turno. Pergunte se prefere manhã ou tarde.',
  'Se o profissional não foi pedido, pergunte quem (não empurre um segundo nome como "tabela"/upgrade).',
].join(' ');

const PERIOD_FOOTER = [
  'Instrução: cite no máximo 1–2 horários do período pedido;',
  'se não couber, 1–2 do outro período no mesmo dia (como alternativas);',
  'depois outro dia ou HANDOFF encaixe. Nunca despeje a grade.',
].join(' ');

function snapshotAgeMinFromSynced(syncedAtList, nowMs = Date.now()) {
  const times = (syncedAtList || [])
    .map((value) => (value == null ? NaN : new Date(value).getTime()))
    .filter((ms) => Number.isFinite(ms));
  if (!times.length) return null;
  return Math.max(0, Math.round((nowMs - Math.max(...times)) / 60000));
}

function prependStaleWarning(text, snapshotAgeMin, staleAfterMin = SNAPSHOT_STALE_OFFER_MIN) {
  const age = Number(snapshotAgeMin);
  if (!Number.isFinite(age) || age < staleAfterMin) return text;
  return `SNAPSHOT: atualizado há ${Math.round(age)} min — horários podem ter sido preenchidos. Não afirme vaga como certa.\n${text}`;
}

function formatClockOfferLines(label, relevant, period, exactClock, durationMin, timeZone) {
  const header = period
    ? `HORARIOS VAGOS ${label} — período ${period === 'morning' ? 'manhã' : 'tarde'} (inícios reais Trinks):`
    : `HORARIOS VAGOS ${label} — inícios reais Trinks (só estes; só se couberem na duração):`;
  const lines = [header];
  for (const prof of relevant) {
    const primary = pickStartsForOffer(prof.startsAt, period, 2, exactClock, durationMin, timeZone);
    if (primary.length) {
      lines.push(`- ${prof.name}: ${formatPickedAnnotatedTimes(primary, prof.startsAt, timeZone)}`);
      continue;
    }
    if (period) {
      const other = period === 'morning' ? 'afternoon' : 'morning';
      const alt = pickStartsForOffer(prof.startsAt, other, 2, exactClock, durationMin, timeZone);
      if (alt.length) {
        lines.push(`- ${prof.name} (alternativas ${other === 'morning' ? 'manhã' : 'tarde'}): ${formatPickedAnnotatedTimes(alt, prof.startsAt, timeZone)}`);
        continue;
      }
    }
    if (durationMin > 0) {
      lines.push(`- ${prof.name}: sem janela contínua de ${durationMin}min neste dia.`);
    } else {
      lines.push(`- ${prof.name}: sem vagas neste dia.`);
    }
  }
  lines.push(period ? `${PERIOD_FOOTER} ${CLOCK_HONESTY_FOOTER}` : CLOCK_HONESTY_FOOTER);
  return { text: lines.join('\n') };
}

/**
 * Compacta bloco HORARIOS VAGOS para scoped BOOKING.
 * Relógios só depois de profissional conhecido (ou pedido explícito de horário com prof no histórico).
 * Sem profissional: ocupação manhã/tarde (economia de crédito). Nunca inventa combinação de janelas.
 */
function compactBookingSlotsBlock({
  label,
  professionals,
  messageText = '',
  historyText = '',
  allowedProfessionalNames = [],
  durationMin = 0,
  snapshotAgeMin = null,
  timeZone = SALON_TZ,
}) {
  const period = detectPeriod(messageText) || detectPeriod(historyText);
  const exactClock = detectExactClock(messageText) || detectExactClock(historyText);
  const mentioned = detectNamedProfessionals(messageText);
  const mentionedTokens = mentioned.length
    ? mentioned
    : detectNamedProfessionals(historyText);

  let pool = filterByAllowedNames(professionals, allowedProfessionalNames);
  const relevant = filterProfessionals(pool, mentionedTokens);

  const finish = (text) => prependStaleWarning(text, snapshotAgeMin);

  if (!relevant.length) {
    return finish(`HORARIOS VAGOS ${label}:\n- Nenhum horario disponivel no snapshot local.`);
  }

  const professionalKnown = mentionedTokens.length > 0;
  const wantsClocks = professionalKnown || (asksForClockList(messageText) && professionalKnown);

  if (wantsClocks) {
    return finish(formatClockOfferLines(label, relevant, period, exactClock, durationMin, timeZone).text);
  }

  if (!period) {
    const occLines = relevant
      .map((p) => occupancyLineForOffer(p.name, p.startsAt, durationMin, timeZone))
      .filter(Boolean);
    if (!occLines.length) {
      return finish(`HORARIOS VAGOS ${label}:\n- Nenhum horario disponivel no snapshot local.`);
    }
    return finish([
      `HORARIOS VAGOS ${label} — OFERTA CONSULTIVA:`,
      ...occLines,
      CONSULTIVA_FOOTER,
    ].join('\n'));
  }

  const occLines = relevant
    .map((p) => periodOccupancyLineForOffer(p.name, p.startsAt, period, durationMin, timeZone))
    .filter(Boolean);
  if (!occLines.length) {
    return finish(`HORARIOS VAGOS ${label}:\n- Nenhum horario disponivel no snapshot local.`);
  }
  return finish([
    `HORARIOS VAGOS ${label} — período ${period === 'morning' ? 'manhã' : 'tarde'}:`,
    ...occLines,
    CONSULTIVA_FOOTER,
  ].join('\n'));
}

module.exports = {
  SALON_TZ,
  detectPeriod,
  detectExactClock,
  detectNamedProfessionals,
  classifySlotPeriod,
  groupOpenSlots,
  formatFullSlotsBlock,
  compactBookingSlotsBlock,
  splitStartsByPeriod,
  pickStartsForPeriod,
  pickStartsForOffer,
  resolveOfferDurationMin,
  narrowServicesForOfferDuration,
  maxSkuDuration,
  minSkuDuration,
  extractSpeechDurationMin,
  skuDurationFrom,
  startsFittingDuration,
  subtractOccupiedSlotStarts,
  shouldEmitSnapshotOffer,
  buildSnapshotOfferEventPayload,
  asksForClockList,
  SNAPSHOT_STALE_OFFER_MIN,
  snapshotAgeMinFromSynced,
  prependStaleWarning,
};
