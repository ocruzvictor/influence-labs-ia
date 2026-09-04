/**
 * Orquestra fetch lazy Trinks + buildDynamicContext por perfil de intenção.
 */

const { buildContextProfile, PROFILES } = require('./tess-context-profiles');
const { logContextBytes } = require('./tess-context-bytes');
const {
  compactBookingSlotsBlock,
  resolveOfferDurationMin,
  SNAPSHOT_STALE_OFFER_MIN,
} = require('./tess-context-slots');
const {
  filterServicesByKeywords,
  isColloquialPenteado,
  formatServicesText,
  renderHabilitacaoMap,
} = require('./booking-parser');

const PENTEADO_DISAMBIGUA = [
  'DISAMBIGUA: neste turno "penteado" pode ser corte de cabelo (tesoura / dia a dia),',
  'nao o SKU Penteado da Gi. Pergunte uma vez qual dos dois.',
].join(' ');

function historyAsText(historyForModel) {
  return (historyForModel || []).map((m) => m.content).join('\n');
}

function filterCatalogForProfile(profileSpec, servicesData, messageText, historyForModel) {
  if (!profileSpec.filterCatalog || !Array.isArray(servicesData) || !servicesData.length) {
    return null;
  }
  const historyText = historyAsText(historyForModel);
  if (profileSpec.profile === PROFILES.BOOKING) {
    const last = filterServicesByKeywords(servicesData, messageText);
    if (last?.length) return last;
  }
  return filterServicesByKeywords(servicesData, `${messageText}\n${historyText}`);
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
    historyForModel,
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
    snapshotAgeMin: null,
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

  const useCompactBooking = config.effectiveMode === 'scoped'
    && profileSpec.profile === PROFILES.BOOKING
    && typeof getSlotsGrouped === 'function';

  if (useCompactBooking && profileSpec.fetchCatalog) {
    fetchMeta.catalogRequested = true;
    svcPayload = await getServicesText();
    const filtered = filterCatalogForProfile(
      profileSpec,
      svcPayload.data,
      messageText,
      historyForModel,
    );
    if (filtered?.length) {
      svcPayload = formatServicesText(filtered);
    }
    if (isColloquialPenteado(messageText) && svcPayload.text) {
      svcPayload = { ...svcPayload, text: `${PENTEADO_DISAMBIGUA}\n${svcPayload.text}` };
    }
  }

  if (profileSpec.fetchSlots) {
    const todayIso = typeof getNextBusinessDays === 'function'
      ? getNextBusinessDays(1)[0]
      : null;
    const refreshDates = [...new Set([todayIso, requestedDate].filter(Boolean))];
    for (const date of refreshDates) {
      try {
        await ensureSlotSnapshot(date);
        if (!slotDates.includes(date)) {
          slotDates.push(date);
          slotDates.sort();
        }
      } catch (err) {
        console.warn(`[${sessionId}] snapshot adicional ${date} falhou:`, err.message);
      }
    }
    if (slotDates.length) {
      fetchMeta.slotsRequested = slotDates.length;
      if (useCompactBooking) {
        const historyText = (historyForModel || []).map((m) => m.content).join('\n');
        const allowedProfessionalNames = [...new Set(
          (svcPayload.data || [])
            .flatMap((s) => (Array.isArray(s.profissionais) ? s.profissionais : []))
            .filter(Boolean),
        )];
        const groupedBlocks = await Promise.all(
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
              durationMin: resolveOfferDurationMin(svcPayload.data),
              snapshotAgeMin: Number.isFinite(age) ? age : null,
            });
          }),
        );
        slotsAll = groupedBlocks.join('\n');
      } else {
        const slotTexts = await Promise.all(slotDates.map((date) => getSlots(date)));
        slotsAll = slotTexts.join('\n');
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
    );
    if (filtered?.length) {
      svcPayload = formatServicesText(filtered);
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
    operatorResumeNote,
  );

  const clientLine = operatorResumeTrigger || messageText;
  const userMessageWithContext = `${dynamicContext}\n\nMENSAGEM DO CLIENTE: ${clientLine}`;

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
    snapshotAgeMin: fetchMeta.snapshotAgeMin,
    snapshotStale: fetchMeta.snapshotAgeMin != null
      && fetchMeta.snapshotAgeMin >= SNAPSHOT_STALE_OFFER_MIN,
    confidence: intentResult?.confidence || null,
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
