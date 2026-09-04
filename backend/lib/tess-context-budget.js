/**
 * Tetos duros de contexto Tess por perfil (P-BUDGET).
 * Puro — sem db. SOT: docs/analysis/2026-09-04-aria-p-budget-tetos.md
 */

const { PROFILES } = require('./tess-context-profiles');
const {
  filterServicesByKeywords,
  formatServicesText,
  renderHabilitacaoMap,
} = require('./booking-parser');

const DEFAULT_CAPS = Object.freeze({
  MIN: 8000,
  FAQ: 8000,
  PRICE: 10000,
  BOOKING: 16000,
  CANCEL: 10000,
  FULL: 24000,
});

const BUDGET_KEYS = Object.freeze([
  'shell',
  'horarios',
  'servicos',
  'habilitacao',
  'profissionais',
  'historico',
  'future_bookings',
]);

const ENV_CAP_KEYS = Object.freeze({
  MIN: 'TESS_CONTEXT_CAP_MIN',
  FAQ: 'TESS_CONTEXT_CAP_FAQ',
  PRICE: 'TESS_CONTEXT_CAP_PRICE',
  BOOKING: 'TESS_CONTEXT_CAP_BOOKING',
  CANCEL: 'TESS_CONTEXT_CAP_CANCEL',
  FULL: 'TESS_CONTEXT_CAP_FULL',
});

const CATALOG_STUB = 'SERVICOS: lista truncada pelo orcamento; peca o nome do servico.';

const CATALOG_PROTECTED_PROFILES = new Set([
  PROFILES.PRICE,
  PROFILES.BOOKING,
  PROFILES.FULL,
]);

const SLOT_PROTECTED_PROFILES = new Set([
  PROFILES.BOOKING,
  PROFILES.FULL,
]);

/**
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 */
function parseContextCaps(env = process.env) {
  const caps = { ...DEFAULT_CAPS };
  for (const [profile, envKey] of Object.entries(ENV_CAP_KEYS)) {
    const raw = env[envKey];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number.parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1000 && n <= 100000) {
      caps[profile] = n;
    }
  }
  return Object.freeze({ ...caps });
}

/**
 * @param {string} profile
 * @param {Record<string, number>} caps
 */
function resolveCap(profile, caps = DEFAULT_CAPS) {
  const key = profile && caps[profile] != null ? profile : PROFILES.FULL;
  return caps[key] ?? caps[PROFILES.FULL] ?? DEFAULT_CAPS.FULL;
}

/**
 * @param {Record<string, string>} blocks
 * @param {string} [dynamicContext]
 */
function measureBudgetChars(blocks = {}, dynamicContext) {
  if (typeof dynamicContext === 'string') {
    return dynamicContext.length;
  }
  let total = 0;
  for (const key of BUDGET_KEYS) {
    total += String(blocks[key] || '').length;
  }
  return total;
}

function historyAsText(historyForModel) {
  return (historyForModel || []).map((m) => m.content).join('\n');
}

function dateMs(iso) {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : 0;
}

function pinDate(requestedDate, todayIso) {
  return requestedDate || todayIso || null;
}

function syncSlotArrays(slotDates, slotDayTexts) {
  const dates = [...(slotDates || [])];
  const texts = [...(slotDayTexts || [])];
  while (texts.length < dates.length) texts.push('');
  while (texts.length > dates.length) texts.pop();
  return { slotDates: dates, slotDayTexts: texts };
}

function slotsAllFromDayTexts(slotDayTexts) {
  return (slotDayTexts || []).filter(Boolean).join('\n');
}

function ensureCatalogFloor(profile, svcPayload, hadCatalog) {
  if (!hadCatalog || !CATALOG_PROTECTED_PROFILES.has(profile)) {
    return svcPayload;
  }
  const data = Array.isArray(svcPayload?.data) ? svcPayload.data : [];
  if (data.length >= 3) {
    return formatServicesText(data.slice(0, 3));
  }
  if (data.length > 0) {
    return formatServicesText(data);
  }
  return { text: CATALOG_STUB, data: [] };
}

function sortFutureBookings(bookings) {
  return [...(bookings || [])].sort(
    (a, b) => dateMs(a.scheduled_at) - dateMs(b.scheduled_at),
  );
}

function futureBookingsLimit(count, profile, originalCount) {
  if (profile === PROFILES.CANCEL && originalCount > 0) {
    return Math.max(1, count);
  }
  return count;
}

/**
 * @param {object} input
 */
function applyContextBudget(input) {
  const {
    profile,
    dynamicContext: initialDynamicContext,
    blocks: initialBlocks = {},
    slotDates: initialSlotDates = [],
    slotDayTexts: initialSlotDayTexts = [],
    requestedDate = null,
    todayIso = null,
    historyForModel: initialHistory = [],
    futureBookings: initialFutureBookings = [],
    svcPayload: initialSvcPayload = { text: '', data: [] },
    profsPayload: initialProfsPayload = { text: '', data: [] },
    habilitacaoText: initialHabilitacao = '',
    messageText = '',
    genderQualifier = null,
    caps = DEFAULT_CAPS,
    rebuild,
  } = input;

  const cap = resolveCap(profile, caps);
  const beforeChars = measureBudgetChars(initialBlocks, initialDynamicContext);
  const daysBefore = (initialSlotDates || []).length;
  const historyTurnsBefore = (initialHistory || []).length;
  const hadCatalog = Boolean(
    (initialSvcPayload?.data?.length)
    || String(initialSvcPayload?.text || '').length,
  );
  const hadSlotDays = daysBefore > 0;
  const originalFutureCount = (initialFutureBookings || []).length;

  let slotDates;
  let slotDayTexts;
  ({ slotDates, slotDayTexts } = syncSlotArrays(initialSlotDates, initialSlotDayTexts));

  let historyForModel = [...(initialHistory || [])];
  let futureBookings = [...(initialFutureBookings || [])];
  let svcPayload = {
    text: initialSvcPayload?.text || '',
    data: Array.isArray(initialSvcPayload?.data) ? [...initialSvcPayload.data] : [],
  };
  let profsPayload = {
    text: initialProfsPayload?.text || '',
    data: Array.isArray(initialProfsPayload?.data) ? [...initialProfsPayload.data] : [],
  };
  let habilitacaoText = initialHabilitacao || '';

  let catalogFiltered = false;
  let catalogSliceK = null;
  let habilitacaoShrunk = false;
  let futureTier = originalFutureCount;

  const stepsApplied = [];

  function remeasure(rebuilt) {
    return measureBudgetChars(rebuilt.blocks, rebuilt.dynamicContext);
  }

  function applyRebuild() {
    if (typeof rebuild !== 'function') {
      const slotsAll = slotsAllFromDayTexts(slotDayTexts);
      return {
        dynamicContext: initialDynamicContext,
        blocks: initialBlocks,
        slotsAll,
      };
    }
    return rebuild({
      slotDates,
      slotDayTexts,
      slotsAll: slotsAllFromDayTexts(slotDayTexts),
      historyForModel,
      futureBookings,
      svcPayload,
      profsPayload,
      habilitacaoText,
    });
  }

  let budgetChars = measureBudgetChars(initialBlocks, initialDynamicContext);

  if (budgetChars <= cap) {
    return {
      dynamicContext: initialDynamicContext,
      blocks: initialBlocks,
      slotDates,
      slotDayTexts,
      historyForModel,
      futureBookings,
      svcPayload,
      profsPayload,
      habilitacaoText,
      trimMeta: {
        trimmed: false,
        before_chars: beforeChars,
        after_chars: budgetChars,
        cap_chars: cap,
        steps_applied: [],
        days_before: daysBefore,
        days_after: slotDates.length,
        history_turns_before: historyTurnsBefore,
        history_turns_after: historyForModel.length,
        hit_protected_floor: false,
      },
    };
  }

  let rebuilt = applyRebuild();
  budgetChars = remeasure(rebuilt);

  if (budgetChars <= cap) {
    return {
      dynamicContext: rebuilt.dynamicContext,
      blocks: rebuilt.blocks,
      slotDates,
      slotDayTexts,
      historyForModel,
      futureBookings,
      svcPayload,
      profsPayload,
      habilitacaoText,
      trimMeta: {
        trimmed: beforeChars > budgetChars,
        before_chars: beforeChars,
        after_chars: budgetChars,
        cap_chars: cap,
        steps_applied: [],
        days_before: daysBefore,
        days_after: slotDates.length,
        history_turns_before: historyTurnsBefore,
        history_turns_after: historyForModel.length,
        hit_protected_floor: false,
      },
    };
  }

  const pin = pinDate(requestedDate, todayIso);

  // Step 1 — drop_slot_days
  while (budgetChars > cap) {
    const minDays = SLOT_PROTECTED_PROFILES.has(profile) && hadSlotDays ? 1 : 0;
    if (slotDates.length <= minDays) break;

    const removable = slotDates
      .map((d, idx) => ({ d, idx, ms: dateMs(d) }))
      .filter(({ d }) => d !== pin);

    if (!removable.length) break;

    const pinMs = pin ? dateMs(pin) : dateMs(slotDates[0]);
    removable.sort((a, b) => Math.abs(b.ms - pinMs) - Math.abs(a.ms - pinMs));
    const dropIdx = removable[0].idx;

    slotDates = slotDates.filter((_, i) => i !== dropIdx);
    slotDayTexts = slotDayTexts.filter((_, i) => i !== dropIdx);

    if (!stepsApplied.includes('drop_slot_days')) {
      stepsApplied.push('drop_slot_days');
    }

    rebuilt = applyRebuild();
    budgetChars = remeasure(rebuilt);
  }

  // Step 2 — filter_catalog
  while (budgetChars > cap) {
    const servicosText = svcPayload.text || '';
    if (!servicosText) break;

    const historyText = historyAsText(historyForModel);
    let changed = false;

    if (!catalogFiltered && Array.isArray(svcPayload.data) && svcPayload.data.length) {
      const filtered = filterServicesByKeywords(
        svcPayload.data,
        `${messageText}\n${historyText}`,
        { genderQualifier },
      );
      if (filtered?.length && filtered.length < svcPayload.data.length) {
        svcPayload = formatServicesText(filtered);
        catalogFiltered = true;
        changed = true;
      } else {
        catalogFiltered = true;
      }
    }

    if (!changed && Array.isArray(svcPayload.data) && svcPayload.data.length > 3) {
      const nextK = catalogSliceK == null
        ? svcPayload.data.length - 1
        : Math.max(3, catalogSliceK - 1);
      if (nextK < svcPayload.data.length) {
        catalogSliceK = nextK;
        svcPayload = formatServicesText(svcPayload.data.slice(0, nextK));
        changed = true;
      }
    }

    if (!changed && Array.isArray(svcPayload.data) && svcPayload.data.length > 0) {
      if (svcPayload.data.length <= 3) {
        break;
      }
    }

    if (!changed) break;

    if (!stepsApplied.includes('filter_catalog')) {
      stepsApplied.push('filter_catalog');
    }

    rebuilt = applyRebuild();
    budgetChars = remeasure(rebuilt);
  }

  if (budgetChars > cap && hadCatalog && CATALOG_PROTECTED_PROFILES.has(profile)) {
    const floorPayload = ensureCatalogFloor(profile, svcPayload, hadCatalog);
    if (floorPayload.text !== svcPayload.text) {
      svcPayload = floorPayload;
      if (!stepsApplied.includes('filter_catalog')) {
        stepsApplied.push('filter_catalog');
      }
      rebuilt = applyRebuild();
      budgetChars = remeasure(rebuilt);
    }
  }

  // Step 3 — shrink_habilitacao
  while (budgetChars > cap) {
    if (!habilitacaoText) break;

    if (!habilitacaoShrunk && Array.isArray(svcPayload.data) && svcPayload.data.length) {
      const nextHab = renderHabilitacaoMap(svcPayload.data);
      if (nextHab !== habilitacaoText) {
        habilitacaoText = nextHab;
        habilitacaoShrunk = true;
        if (!stepsApplied.includes('shrink_habilitacao')) {
          stepsApplied.push('shrink_habilitacao');
        }
        rebuilt = applyRebuild();
        budgetChars = remeasure(rebuilt);
        continue;
      }
      habilitacaoShrunk = true;
    }

    if (habilitacaoText) {
      habilitacaoText = '';
      if (!stepsApplied.includes('shrink_habilitacao')) {
        stepsApplied.push('shrink_habilitacao');
      }
      rebuilt = applyRebuild();
      budgetChars = remeasure(rebuilt);
      continue;
    }
    break;
  }

  // Step 4 — drop_profissionais
  if (budgetChars > cap && profsPayload.text) {
    profsPayload = { ...profsPayload, text: '' };
    if (!stepsApplied.includes('drop_profissionais')) {
      stepsApplied.push('drop_profissionais');
    }
    rebuilt = applyRebuild();
    budgetChars = remeasure(rebuilt);
  }

  // Step 5 — shorten_history (soft floor 2 → 1 → [] while still over cap)
  while (budgetChars > cap && historyForModel.length > 0) {
    historyForModel = historyForModel.slice(1);
    if (!stepsApplied.includes('shorten_history')) {
      stepsApplied.push('shorten_history');
    }
    rebuilt = applyRebuild();
    budgetChars = remeasure(rebuilt);
  }

  // Step 6 — truncate_future_bookings
  while (budgetChars > cap && futureBookings.length > 0) {
    const sorted = sortFutureBookings(futureBookings);
    let nextCount;
    if (futureTier > 3) {
      nextCount = 3;
    } else if (futureTier > 1) {
      nextCount = 1;
    } else {
      nextCount = 0;
    }
    nextCount = futureBookingsLimit(nextCount, profile, originalFutureCount);

    if (nextCount >= sorted.length) break;

    futureTier = nextCount;
    futureBookings = sorted.slice(0, nextCount);

    if (!stepsApplied.includes('truncate_future_bookings')) {
      stepsApplied.push('truncate_future_bookings');
    }
    rebuilt = applyRebuild();
    budgetChars = remeasure(rebuilt);
  }

  const afterChars = budgetChars;
  const hitProtectedFloor = afterChars > cap;

  return {
    dynamicContext: rebuilt.dynamicContext,
    blocks: rebuilt.blocks,
    slotDates,
    slotDayTexts,
    historyForModel,
    futureBookings,
    svcPayload,
    profsPayload,
    habilitacaoText,
    trimMeta: {
      trimmed: beforeChars > afterChars,
      before_chars: beforeChars,
      after_chars: afterChars,
      cap_chars: cap,
      steps_applied: stepsApplied,
      days_before: daysBefore,
      days_after: slotDates.length,
      history_turns_before: historyTurnsBefore,
      history_turns_after: historyForModel.length,
      hit_protected_floor: hitProtectedFloor,
    },
  };
}

module.exports = {
  DEFAULT_CAPS,
  BUDGET_KEYS,
  CATALOG_STUB,
  parseContextCaps,
  resolveCap,
  measureBudgetChars,
  applyContextBudget,
};
