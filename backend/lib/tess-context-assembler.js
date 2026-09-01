/**
 * Orquestra fetch lazy Trinks + buildDynamicContext por perfil de intenção.
 */

const { buildContextProfile, PROFILES } = require('./tess-context-profiles');
const { logContextBytes } = require('./tess-context-bytes');
const {
  filterServicesByKeywords,
  formatServicesText,
  renderHabilitacaoMap,
} = require('./booking-parser');

/**
 * Resolve datas de slot conforme perfil.
 */
function resolveSlotDates({
  profileSpec,
  getNextBusinessDays,
  mergeSlotContextDates,
  nextSaturdayDates,
  slotContextDays,
  requestedDate,
  ensureSlotSnapshot,
  sessionId,
}) {
  if (!profileSpec.fetchSlots) return [];

  if (profileSpec.profile === PROFILES.FULL) {
    return mergeSlotContextDates(
      getNextBusinessDays(slotContextDays),
      nextSaturdayDates(5, 35),
    );
  }

  if (profileSpec.explicitDateOnly && requestedDate) {
    return [requestedDate];
  }

  const days = Math.max(1, profileSpec.slotDays || 1);
  let dates = getNextBusinessDays(days);
  if (profileSpec.includeSaturdays) {
    dates = mergeSlotContextDates(dates, nextSaturdayDates(2, 21));
  }
  return dates;
}

/**
 * @param {object} params
 * @returns {Promise<object>}
 */
async function assembleTessContext(params) {
  const {
    sessionId,
    messageText,
    phone,
    intentResult,
    config,
    slotContextDays,
    requestedDate,
    historyForModel,
    persistedForModel,
    trinksCanonicalName,
    buildDynamicContext,
    getSlots,
    getProfessionals,
    getServicesText,
    loadClientFutureBookings,
    ensureSlotSnapshot,
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
  } = params;

  const profileSpec = buildContextProfile(intentResult, {
    effectiveMode: config.effectiveMode,
    slotContextDays,
    requestedDate,
  });

  const fetchMeta = {
    slotsRequested: 0,
    catalogRequested: false,
    professionalsRequested: false,
    futureBookingsRequested: false,
  };

  let slotDates = [];
  let slotsAll = '';
  let profsPayload = { text: '', data: [] };
  let svcPayload = { text: '', data: [] };
  let futureBookings = [];

  if (profileSpec.fetchFutureBookings && phone) {
    fetchMeta.futureBookingsRequested = true;
    futureBookings = await loadClientFutureBookings(phone);
  }

  slotDates = resolveSlotDates({
    profileSpec,
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
    slotContextDays,
    requestedDate,
    ensureSlotSnapshot,
    sessionId,
  });

  if (profileSpec.fetchSlots) {
    if (requestedDate) {
      try {
        await ensureSlotSnapshot(requestedDate);
        if (!slotDates.includes(requestedDate)) {
          slotDates.push(requestedDate);
          slotDates.sort();
        }
      } catch (err) {
        console.warn(`[${sessionId}] snapshot adicional ${requestedDate} falhou:`, err.message);
      }
    }
    if (slotDates.length) {
      fetchMeta.slotsRequested = slotDates.length;
      const slotTexts = await Promise.all(slotDates.map((date) => getSlots(date)));
      slotsAll = slotTexts.join('\n');
    }
  }

  if (profileSpec.fetchCatalog) {
    fetchMeta.catalogRequested = true;
    svcPayload = await getServicesText();
    if (profileSpec.filterCatalog && svcPayload.data?.length) {
      const filtered = filterServicesByKeywords(svcPayload.data, messageText);
      if (filtered?.length) {
        svcPayload = formatServicesText(filtered);
      }
    }
  }

  if (profileSpec.fetchProfessionals) {
    fetchMeta.professionalsRequested = true;
    profsPayload = await getProfessionals();
  }

  const habilitacaoText = profileSpec.fetchHabilitacao && svcPayload.data?.length
    ? renderHabilitacaoMap(svcPayload.data)
    : '';

  const dynamicContext = buildDynamicContext(
    slotDates,
    slotsAll,
    profsPayload.text || '',
    historyForModel,
    svcPayload.text || '',
    persistedForModel,
    futureBookings,
    habilitacaoText,
    phone,
    requestedDate,
    trinksCanonicalName,
  );

  const userMessageWithContext = `${dynamicContext}\n\nMENSAGEM DO CLIENTE: ${messageText}`;

  const shellEstimate = dynamicContext
    .replace(slotsAll || '', '')
    .replace(svcPayload.text || '', '')
    .replace(habilitacaoText || '', '')
    .replace(profsPayload.text || '', '');

  const historicoPart = historyForModel?.length
    ? historyForModel.map((m) => m.content).join('\n')
    : '';

  const blocks = {
    shell: shellEstimate,
    horarios: slotsAll,
    servicos: svcPayload.text || '',
    habilitacao: habilitacaoText,
    profissionais: profsPayload.text || '',
    historico: historicoPart,
    future_bookings: futureBookings.length ? JSON.stringify(futureBookings) : '',
    user_payload: userMessageWithContext,
  };

  return {
    dynamicContext,
    userMessageWithContext,
    contextProfile: profileSpec.profile,
    intent: intentResult.intent,
    slotDates,
    fetchMeta,
    blocks,
    futureBookings,
    profileSpec,
    svcPayload,
    profsPayload,
  };
}

function emitContextBytesLog(ctx, sessionId, config, skippedTess = false) {
  return logContextBytes({
    sessionId,
    intent: ctx.intent,
    contextProfile: ctx.contextProfile,
    skippedTess,
    blocks: ctx.blocks,
    mode: config.effectiveMode,
  });
}

function extractTessCredits(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidates = [
    raw.responses?.[0]?.credits,
    raw.responses?.[0]?.credit_cost,
    raw.credits,
    raw.credit_cost,
    raw.usage?.credits,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
}

function logTessTurnTelemetry({
  sessionId,
  intent,
  contextProfile,
  skippedTess,
  tessCredits,
}) {
  const payload = {
    event: 'tess.turn',
    sessionId: sessionId || null,
    intent: intent || null,
    context_profile: contextProfile || null,
    skipped_tess: Boolean(skippedTess),
    tess_credits: tessCredits ?? null,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
  return payload;
}

module.exports = {
  assembleTessContext,
  resolveSlotDates,
  emitContextBytesLog,
  extractTessCredits,
  logTessTurnTelemetry,
};
