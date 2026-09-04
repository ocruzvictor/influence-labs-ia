/**
 * Perfis de contexto Trinks por intenção (architecture §4.5 + §5.3).
 */

const { INTENTS } = require('./tess-context-intent');

const PROFILES = Object.freeze({
  MIN: 'MIN',
  FAQ: 'FAQ',
  PRICE: 'PRICE',
  BOOKING: 'BOOKING',
  CANCEL: 'CANCEL',
  FULL: 'FULL',
});

function buildMinProfile() {
  return {
    profile: PROFILES.MIN,
    fetchSlots: false,
    fetchCatalog: false,
    fetchProfessionals: false,
    fetchHabilitacao: false,
    fetchFutureBookings: false,
    slotDays: 0,
    includeSaturdays: false,
    filterCatalog: false,
    explicitDateOnly: false,
  };
}

/**
 * @param {{ intent: string, confidence: string, signals?: string[] }} intentResult
 * @param {{ effectiveMode: string, slotContextDays: number, requestedDate?: string|null, hasServiceSignal?: boolean, keepBookingWithoutSku?: boolean }} opts
 */
function buildContextProfile(intentResult, opts = {}) {
  const { intent, confidence } = intentResult || {};
  const effectiveMode = opts.effectiveMode || 'full';
  const slotContextDays = Math.max(1, Number(opts.slotContextDays) || 10);
  const requestedDate = opts.requestedDate || null;
  const hasServiceSignalFlag = opts.hasServiceSignal !== undefined ? opts.hasServiceSignal : true;
  const keepBookingWithoutSku = opts.keepBookingWithoutSku === true;

  if (intent === INTENTS.UNCERTAIN) {
    return buildMinProfile();
  }

  if (intent === INTENTS.CANCEL && confidence === 'high') {
    return {
      profile: PROFILES.CANCEL,
      fetchSlots: false,
      fetchCatalog: false,
      fetchProfessionals: false,
      fetchHabilitacao: false,
      fetchFutureBookings: true,
      slotDays: 0,
      includeSaturdays: false,
      filterCatalog: false,
      explicitDateOnly: false,
    };
  }

  if (
    effectiveMode !== 'full'
    && (intent === INTENTS.SCHEDULING || intent === INTENTS.RESCHEDULE)
    && hasServiceSignalFlag === false
    && !keepBookingWithoutSku
  ) {
    return buildMinProfile();
  }

  if (effectiveMode === 'full') {
    return {
      profile: PROFILES.FULL,
      fetchSlots: true,
      fetchCatalog: true,
      fetchProfessionals: true,
      fetchHabilitacao: true,
      fetchFutureBookings: true,
      slotDays: slotContextDays,
      includeSaturdays: true,
      filterCatalog: false,
      explicitDateOnly: false,
    };
  }

  switch (intent) {
    case INTENTS.TRIVIAL:
      return {
        profile: PROFILES.MIN,
        fetchSlots: false,
        fetchCatalog: false,
        fetchProfessionals: false,
        fetchHabilitacao: false,
        fetchFutureBookings: false,
        slotDays: 0,
        includeSaturdays: false,
        filterCatalog: false,
        explicitDateOnly: false,
      };

    case INTENTS.FAQ:
    case INTENTS.HANDOFF_LIKELY:
      return {
        profile: PROFILES.FAQ,
        fetchSlots: false,
        fetchCatalog: false,
        fetchProfessionals: false,
        fetchHabilitacao: false,
        fetchFutureBookings: false,
        slotDays: 0,
        includeSaturdays: false,
        filterCatalog: false,
        explicitDateOnly: false,
      };

    case INTENTS.PRICING:
      return {
        profile: PROFILES.PRICE,
        fetchSlots: false,
        fetchCatalog: true,
        fetchProfessionals: false,
        fetchHabilitacao: true,
        fetchFutureBookings: false,
        slotDays: 0,
        includeSaturdays: false,
        filterCatalog: true,
        explicitDateOnly: false,
      };

    case INTENTS.SCHEDULING:
    case INTENTS.RESCHEDULE: {
      const bookingDays = requestedDate
        ? 1
        : Math.min(slotContextDays, 3);
      return {
        profile: PROFILES.BOOKING,
        fetchSlots: true,
        fetchCatalog: true,
        fetchProfessionals: true,
        fetchHabilitacao: true,
        fetchFutureBookings: true,
        slotDays: bookingDays,
        includeSaturdays: !requestedDate,
        filterCatalog: true,
        explicitDateOnly: Boolean(requestedDate),
      };
    }

    case INTENTS.CANCEL:
      return {
        profile: PROFILES.CANCEL,
        fetchSlots: false,
        fetchCatalog: false,
        fetchProfessionals: false,
        fetchHabilitacao: false,
        fetchFutureBookings: true,
        slotDays: 0,
        includeSaturdays: false,
        filterCatalog: false,
        explicitDateOnly: false,
      };

    default:
      return buildContextProfile(
        { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: [] },
        { ...opts, effectiveMode: 'scoped' },
      );
  }
}

module.exports = {
  PROFILES,
  buildContextProfile,
};
