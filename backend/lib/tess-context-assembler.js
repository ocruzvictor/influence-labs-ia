/**
 * Orquestra fetch lazy Trinks + buildDynamicContext por perfil de intenção.
 */

const { buildContextProfile, PROFILES } = require('./tess-context-profiles');
const {
  normalizeText,
  hasServiceSignal,
  isSchedulingInProgress,
  isDraftSchedulingContext,
  isPostBookingFailedContext,
} = require('./tess-context-intent');
const { logContextBytes } = require('./tess-context-bytes');
const { applyContextBudget, parseContextCaps } = require('./tess-context-budget');
const {
  compactBookingSlotsBlock,
  resolveOfferDurationMin,
  SNAPSHOT_STALE_OFFER_MIN,
} = require('./tess-context-slots');
const {
  filterServicesByKeywords,
  isColloquialPenteado,
  isColloquialPezinho,
  isSoloPezinhoTurn,
  formatServicesText,
  renderHabilitacaoMap,
} = require('./booking-parser');

const PENTEADO_DISAMBIGUA = [
  'DISAMBIGUA: neste turno "penteado" pode ser corte de cabelo (tesoura / dia a dia),',
  'nao o SKU Penteado da Gi. Pergunte uma vez qual dos dois.',
].join(' ');

const PEZINHO_DISAMBIGUA = [
  'DISAMBIGUA: Pezinho do cabelo = acabamento de corte (contorno orelha-pescoco).',
  'Nao e pedicure. Nao e Cabelo e Barba. Nao precisa agendar.',
  'E cortesia, feito no intervalo entre clientes, gratuito.',
  'Nao emita [HANDOFF_HUMAN]. Nao emita [BOOKING_CREATE]. Nao invente SKU.',
  'Diga que pode passar sem marcar.',
].join(' ');

function buildContextBlocks({
  dynamicContext,
  slotsAll,
  svcPayload,
  habilitacaoText,
  profsPayload,
  historyForModel,
  futureBookings,
  userMessageWithContext,
}) {
  const shellEstimate = dynamicContext
    .replace(slotsAll || '', '')
    .replace(svcPayload.text || '', '')
    .replace(habilitacaoText || '', '')
    .replace(profsPayload.text || '', '');

  const historicoPart = historyForModel?.length
    ? historyForModel.map((m) => m.content).join('\n')
    : '';

  return {
    shell: shellEstimate,
    horarios: slotsAll,
    servicos: svcPayload.text || '',
    habilitacao: habilitacaoText,
    profissionais: profsPayload.text || '',
    historico: historicoPart,
    future_bookings: futureBookings.length ? JSON.stringify(futureBookings) : '',
    user_payload: userMessageWithContext,
  };
}

function historyAsText(historyForModel) {
  return (historyForModel || []).map((m) => m.content).join('\n');
}

function filterCatalogForProfile(profileSpec, servicesData, messageText, historyForModel, genderQualifier = null) {
  if (!profileSpec.filterCatalog || !Array.isArray(servicesData) || !servicesData.length) {
    return null;
  }
  const historyText = historyAsText(historyForModel);
  const filterOpts = { genderQualifier };
  if (profileSpec.profile === PROFILES.BOOKING) {
    const last = filterServicesByKeywords(servicesData, messageText, filterOpts);
    if (last?.length) return last;
  }
  return filterServicesByKeywords(servicesData, `${messageText}\n${historyText}`, filterOpts);
}

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
    persistedForModel,
    trinksCanonicalName,
    operatorResumeNote,
    operatorResumeTrigger,
    buildDynamicContext,
    getSlots,
    getSlotsGrouped,
    getProfessionals,
    getServicesText,
    loadClientFutureBookings,
    ensureSlotSnapshot,
    getNextBusinessDays,
    mergeSlotContextDates,
    nextSaturdayDates,
  } = params;

  const genderQualifier = params.genderQualifier ?? null;
  let historyForModel = [...(params.historyForModel || [])];
  const lastBookingOutcome = params.lastBookingOutcome;

  const profileSpec = buildContextProfile(intentResult, {
    effectiveMode: config.effectiveMode,
    slotContextDays,
    requestedDate,
    hasServiceSignal: hasServiceSignal(normalizeText(messageText)),
    keepBookingWithoutSku: isSchedulingInProgress(historyForModel)
      || isDraftSchedulingContext(historyForModel)
      || isPostBookingFailedContext(historyForModel, lastBookingOutcome),
  });

  const fetchMeta = {
    slotsRequested: 0,
    catalogRequested: false,
    professionalsRequested: false,
    futureBookingsRequested: false,
    snapshotAgeMin: null,
  };

  let slotDates = [];
  let slotDayTexts = [];
  let slotsAll = '';
  let profsPayload = { text: '', data: [] };
  let svcPayload = { text: '', data: [] };
  let futureBookings = [];

  const todayIso = typeof getNextBusinessDays === 'function'
    ? getNextBusinessDays(1)[0]
    : null;

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

  const useCompactBooking = config.effectiveMode === 'scoped'
    && profileSpec.profile === PROFILES.BOOKING
    && typeof getSlotsGrouped === 'function';

  const soloPezinhoTurn = isSoloPezinhoTurn(messageText);

  if (useCompactBooking && profileSpec.fetchCatalog) {
    fetchMeta.catalogRequested = true;
    if (soloPezinhoTurn) {
      svcPayload = { text: PEZINHO_DISAMBIGUA, data: [] };
    } else {
      svcPayload = await getServicesText();
      const filtered = filterCatalogForProfile(
        profileSpec,
        svcPayload.data,
        messageText,
        historyForModel,
        genderQualifier,
      );
      if (filtered?.length) {
        svcPayload = formatServicesText(filtered);
      }
      if (isColloquialPenteado(messageText) && svcPayload.text) {
        svcPayload = { ...svcPayload, text: `${PENTEADO_DISAMBIGUA}\n${svcPayload.text}` };
      }
      if (isColloquialPezinho(messageText) && svcPayload.text) {
        svcPayload = { ...svcPayload, text: `${PEZINHO_DISAMBIGUA}\n${svcPayload.text}` };
      }
    }
  }

  if (profileSpec.fetchSlots && !soloPezinhoTurn) {
    const refreshDates = [...new Set(slotDates.filter(Boolean))];
    for (const date of refreshDates) {
      try {
        await ensureSlotSnapshot(date);
      } catch (err) {
        console.warn(`[${sessionId}] snapshot refresh ${date} falhou:`, err.message);
      }
    }
    if (slotDates.length) {
      fetchMeta.slotsRequested = slotDates.length;
      if (useCompactBooking) {
        const historyText = historyAsText(historyForModel);
        const allowedProfessionalNames = [...new Set(
          (svcPayload.data || [])
            .flatMap((s) => (Array.isArray(s.profissionais) ? s.profissionais : []))
            .filter(Boolean),
        )];
        slotDayTexts = await Promise.all(
          slotDates.map(async (date) => {
            const grouped = await getSlotsGrouped(date);
            const age = Number(grouped.snapshotAgeMin);
            if (Number.isFinite(age)) {
              fetchMeta.snapshotAgeMin = fetchMeta.snapshotAgeMin == null
                ? age
                : Math.max(fetchMeta.snapshotAgeMin, age);
            }
            return compactBookingSlotsBlock({
              label: grouped.label,
              professionals: grouped.professionals,
              messageText,
              historyText,
              allowedProfessionalNames,
              durationMin: resolveOfferDurationMin(svcPayload.data, { messageText, genderQualifier }),
              snapshotAgeMin: Number.isFinite(age) ? age : null,
            });
          }),
        );
        slotsAll = slotDayTexts.join('\n');
      } else {
        slotDayTexts = await Promise.all(slotDates.map((date) => getSlots(date)));
        slotsAll = slotDayTexts.join('\n');
      }
    }
  }

  if (profileSpec.fetchCatalog && !fetchMeta.catalogRequested) {
    fetchMeta.catalogRequested = true;
    svcPayload = await getServicesText();
    const filtered = filterCatalogForProfile(
      profileSpec,
      svcPayload.data,
      messageText,
      historyForModel,
      genderQualifier,
    );
    if (filtered?.length) {
      svcPayload = formatServicesText(filtered);
    }
  }

  if (profileSpec.fetchProfessionals) {
    fetchMeta.professionalsRequested = true;
    profsPayload = await getProfessionals();
  }

  let habilitacaoText = profileSpec.fetchHabilitacao && svcPayload.data?.length
    ? renderHabilitacaoMap(svcPayload.data)
    : '';

  const clientLine = operatorResumeTrigger || messageText;
  const caps = parseContextCaps(process.env);

  function rebuildBudgetState(state) {
    const nextSlotsAll = state.slotsAll ?? state.slotDayTexts.join('\n');
    const nextDynamicContext = buildDynamicContext(
      state.slotDates,
      nextSlotsAll,
      state.profsPayload.text || '',
      state.historyForModel,
      state.svcPayload.text || '',
      persistedForModel,
      state.futureBookings,
      state.habilitacaoText,
      phone,
      requestedDate,
      trinksCanonicalName,
      operatorResumeNote,
    );
    const nextUserMessage = `${nextDynamicContext}\n\nMENSAGEM DO CLIENTE: ${clientLine}`;
    const nextBlocks = buildContextBlocks({
      dynamicContext: nextDynamicContext,
      slotsAll: nextSlotsAll,
      svcPayload: state.svcPayload,
      habilitacaoText: state.habilitacaoText,
      profsPayload: state.profsPayload,
      historyForModel: state.historyForModel,
      futureBookings: state.futureBookings,
      userMessageWithContext: nextUserMessage,
    });
    return {
      dynamicContext: nextDynamicContext,
      blocks: nextBlocks,
      slotsAll: nextSlotsAll,
      userMessageWithContext: nextUserMessage,
    };
  }

  let dynamicContext = buildDynamicContext(
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
    operatorResumeNote,
  );

  let userMessageWithContext = `${dynamicContext}\n\nMENSAGEM DO CLIENTE: ${clientLine}`;
  let blocks = buildContextBlocks({
    dynamicContext,
    slotsAll,
    svcPayload,
    habilitacaoText,
    profsPayload,
    historyForModel,
    futureBookings,
    userMessageWithContext,
  });

  const budgeted = applyContextBudget({
    profile: profileSpec.profile,
    intent: intentResult.intent,
    confidence: intentResult?.confidence || null,
    mode: config.effectiveMode,
    dynamicContext,
    blocks,
    slotDates,
    slotDayTexts,
    requestedDate,
    todayIso,
    historyForModel,
    futureBookings,
    svcPayload,
    profsPayload,
    habilitacaoText,
    messageText,
    genderQualifier,
    caps,
    rebuild: (state) => rebuildBudgetState(state),
  });

  dynamicContext = budgeted.dynamicContext;
  blocks = budgeted.blocks;
  slotDates = budgeted.slotDates;
  slotDayTexts = budgeted.slotDayTexts;
  historyForModel = budgeted.historyForModel;
  futureBookings = budgeted.futureBookings;
  svcPayload = budgeted.svcPayload;
  profsPayload = budgeted.profsPayload;
  habilitacaoText = budgeted.habilitacaoText;
  slotsAll = slotDayTexts.join('\n');
  userMessageWithContext = `${dynamicContext}\n\nMENSAGEM DO CLIENTE: ${clientLine}`;
  blocks.user_payload = userMessageWithContext;

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
    snapshotAgeMin: fetchMeta.snapshotAgeMin,
    snapshotStale: fetchMeta.snapshotAgeMin != null
      && fetchMeta.snapshotAgeMin >= SNAPSHOT_STALE_OFFER_MIN,
    confidence: intentResult?.confidence || null,
    trimMeta: budgeted.trimMeta,
  };
}

function emitContextBytesLog(ctx, sessionId, config, skippedTess = false, extra = {}) {
  return logContextBytes({
    sessionId,
    intent: ctx.intent,
    confidence: extra.confidence || ctx.confidence || null,
    contextProfile: ctx.contextProfile,
    skippedTess,
    blocks: ctx.blocks,
    mode: config.effectiveMode,
    traceId: extra.traceId || null,
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
  sentChars,
  timedOut,
  salonDay,
}) {
  const payload = {
    event: 'tess.turn',
    sessionId: sessionId || null,
    intent: intent || null,
    context_profile: contextProfile || null,
    skipped_tess: Boolean(skippedTess),
    tess_credits: tessCredits ?? null,
    sent_chars: Number(sentChars) || 0,
    timed_out: Boolean(timedOut),
    salon_day: salonDay || null,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
  return payload;
}

module.exports = {
  assembleTessContext,
  filterCatalogForProfile,
  resolveSlotDates,
  emitContextBytesLog,
  extractTessCredits,
  logTessTurnTelemetry,
};
