/**
 * Classificador determinístico de intenção — hot-path TESS (sem LLM extra).
 * UNCERTAIN → perfil MIN (desambiguação). Confiança baixa em intent conhecido
 * usa o perfil do intent quando o modo é scoped; FULL só com TESS_CONTEXT_MODE=full.
 */

const { IMAGE_MARKER, STICKER_MARKER } = require('./kapso-media');
const { FILTER_SERVICE_KEYWORDS } = require('./booking-parser');

const INTENTS = Object.freeze({
  TRIVIAL: 'TRIVIAL',
  FAQ: 'FAQ',
  SCHEDULING: 'SCHEDULING',
  PRICING: 'PRICING',
  CANCEL: 'CANCEL',
  RESCHEDULE: 'RESCHEDULE',
  HANDOFF_LIKELY: 'HANDOFF_LIKELY',
  UNCERTAIN: 'UNCERTAIN',
});

const PRICE_RE = /\b(quanto|preco|preço|valor|custa|custo|quanto\s+fica|em conta|mais barato)\b/i;
const FAQ_RE = /\b(endereco|endereço|onde fica|estacionamento|pix|pagamento|formas de pagamento|horario de funcionamento|horário de funcionamento|funcionamento|como chegar)\b/i;
const CANCEL_RE = /\b(cancela|cancelar|cancel|desmarc|desmarquei|nao vou|não vou)\b/i;
const ABORT_DISMISS_RE = /\b(deixa pra la|deixa pra lá|desisto|esquece|mudei de ideia|nao quero mais|não quero mais)\b/i;
const RESCHEDULE_RE = /\b(remarc|mudar horario|mudar horário|trocar horario|trocar horário|outro horario|outro horário)\b/i;
// Alias legado: clientes ainda pedem humano pelo nome de quem atendia antes.
const HANDOFF_RE = /\b(falar com|humano|gabriel|atendente|pessoa real)\b/i;
const DATE_RE = /\b(amanha|amanhã|hoje|tarde|noite|segunda|terca|terça|quarta|quinta|sext[ao]|sabado|sábado|domingo|\d{1,2}[\/\-]\d{1,2}|\d{1,2}h(?!\s+(de\s+)?(atendimento|duracao|servico|sessao)\b)|\d{1,2}:\d{2})\b/i;
const PROFESSIONAL_RE = /\b(tiago|andre|andré|erick|erik|eric|fefe|fernanda|gi\b|giovanna|claudia|cláudia|bruuna|bruna|jackie|jacki|jaque|jaqueline|kamila|camila|dylan|eli)\b/i;
const ROLE_RE = /\bmaquiador(?:a|es|as)?\b/i;

const SERVICE_KEYWORDS = FILTER_SERVICE_KEYWORDS;

const SCHEDULING_QUESTION_RE = /\b(horario|horário|qual servico|qual serviço|qual dia|qual data|que horas|prefere|escolhe|confirma|profissional|disponivel|disponível)\b/i;
const POST_FAILED_ASSISTANT_RE = /\b(problema tecnico|problema técnico|nao consegui gravar|não consegui gravar|nao fecha na agenda|não fecha na agenda|nao fecha dentro do expediente|não fecha dentro do expediente)\b/i;
const SCHEDULING_CONTINUATION_RE = /\b(outro dia|outro horario|outro horário|pode ser outro|prefere outro|tenta outro|remarc)\b/i;

const TRIVIAL_EXACT = new Set([
  'oi', 'ola', 'olá', 'oie',
  'bom dia', 'boa tarde', 'boa noite',
  'valeu', 'ok', 'ta bom', 'tá bom',
]);

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDurationHourToken(norm, index) {
  if (!norm || index == null || index < 0) return false;
  const patterns = [
    /\b\d{1,2}\s*h\s+(de\s+)?(atendimento|duracao|servico|sessao)\b/g,
    /\b(leva|demora|dura[m]?|sao|são)\s+\d{1,2}\s*h\b/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(norm)) !== null) {
      if (index >= m.index && index < m.index + m[0].length) return true;
    }
  }
  return false;
}

function hasServiceSignal(norm) {
  return SERVICE_KEYWORDS.some((kw) => norm.includes(kw));
}

function hasPriceSignal(norm) {
  return PRICE_RE.test(norm);
}

function hasDateSignal(norm) {
  const withoutHour = /\b(amanha|amanhã|hoje|tarde|noite|segunda|terca|terça|quarta|quinta|sext[ao]|sabado|sábado|domingo|\d{1,2}[\/\-]\d{1,2}|\d{1,2}:\d{2})\b/i;
  if (withoutHour.test(norm)) return true;
  const hourRe = /\b(\d{1,2})\s*h\b|\b(\d{1,2})h(\d{2})\b/g;
  let m;
  while ((m = hourRe.exec(norm)) !== null) {
    if (!isDurationHourToken(norm, m.index)) return true;
  }
  return false;
}

function hasProfessionalSignal(norm) {
  return PROFESSIONAL_RE.test(norm) || ROLE_RE.test(norm);
}

function hasFaqSignal(norm) {
  return FAQ_RE.test(norm);
}

function hasCancelSignal(norm) {
  return CANCEL_RE.test(norm);
}

function hasRescheduleSignal(norm) {
  return RESCHEDULE_RE.test(norm);
}

function hasHandoffSignal(norm) {
  return HANDOFF_RE.test(norm);
}

function isMediaMessage(messageText) {
  const s = String(messageText || '');
  return /\[(CLIENTE ENVIOU (IMAGEM|STICKER|AUDIO|VIDEO|ÁUDIO))\]/i.test(s)
    || s.includes(IMAGE_MARKER)
    || s.includes(STICKER_MARKER);
}

function isAudioTranscript(messageText) {
  return /\[AUDIO TRANSCRITO\]/i.test(String(messageText || ''));
}

const PASSIVE_PERSIST_INTENTS = new Set([INTENTS.SCHEDULING, INTENTS.FAQ]);

function hasPersistibleSignal(norm) {
  return hasServiceSignal(norm)
    || hasDateSignal(norm)
    || hasProfessionalSignal(norm)
    || hasFaqSignal(norm)
    || hasSchedulingAsk(norm);
}

function isLaughterOrEmojiOnly(text) {
  const stripped = String(text || '').replace(/\s+/g, '');
  return /^(k{2,}|haha+|rs+|kkk+|lol|👍|😊|🙏)+$/i.test(stripped);
}

function isDurationAlone(norm) {
  if (hasDateSignal(norm)) return false;
  const hourRe = /\b(\d{1,2})\s*h\b|\b(\d{1,2})h(\d{2})\b/g;
  let m;
  let hasHourToken = false;
  while ((m = hourRe.exec(norm)) !== null) {
    hasHourToken = true;
    if (!isDurationHourToken(norm, m.index)) return false;
  }
  return hasHourToken;
}

function isLeroUtterance(messageText) {
  const norm = normalizeText(messageText);
  if (!norm) return true;
  if (hasPersistibleSignal(norm)) return false;
  if (isTrivialAllowlist(messageText)) return true;
  if (isLaughterOrEmojiOnly(messageText)) return true;
  if (/^dia[\s-]a[\s-]dia$/i.test(norm)) return true;
  if (/\b(ja tem cliente|já tem cliente|opcao que ja tem cliente|opção que já tem cliente)\b/i.test(norm)) {
    return true;
  }
  if (isDurationAlone(norm)) return true;
  return false;
}

function isIntentDenylist(messageText) {
  if (isMediaMessage(messageText)) return true;
  if (isAudioTranscript(messageText)) return true;
  if (!normalizeText(messageText)) return true;
  if (isLeroUtterance(messageText)) return true;
  return false;
}

function intentToPersist(result, text, { path = 'passive' } = {}) {
  if (isIntentDenylist(text)) return null;
  const intent = result?.intent;
  if (path === 'passive') {
    if (PASSIVE_PERSIST_INTENTS.has(intent)) return intent;
    return null;
  }
  return intent || null;
}

function isTrivialAllowlist(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  if (TRIVIAL_EXACT.has(norm)) return true;
  if (/^obrigad/.test(norm) && norm.length <= 14) return true;
  if ((norm === 'tudo bem' || norm === 'td bem') && !norm.includes('?')) return true;
  return false;
}

function hasSchedulingAsk(norm) {
  return /\b(agendar|quero marcar|marcar( um)? horario|vim pelo)\b/.test(norm);
}

function isSimpleBookingBundle(norm) {
  if (hasPriceSignal(norm) || hasCancelSignal(norm) || hasRescheduleSignal(norm) || hasFaqSignal(norm)) {
    return false;
  }
  const bits = [hasDateSignal(norm), hasServiceSignal(norm), hasProfessionalSignal(norm)]
    .filter(Boolean).length;
  return bits >= 2;
}

function hasCompoundIntent(messageText) {
  const norm = normalizeText(messageText);
  if (/^(oi|ola|olá|oie|bom dia|boa tarde|boa noite)\s+\S/.test(norm)) return true;
  if (hasSchedulingAsk(norm)) return true;
  if (hasServiceSignal(norm) || hasDateSignal(norm) || hasPriceSignal(norm)) return true;
  if (hasProfessionalSignal(norm)) return true;
  return false;
}

function isPostBookingFailedContext(history, lastBookingOutcome) {
  if (lastBookingOutcome === 'failed' || lastBookingOutcome === 'blocked') return true;
  if (!Array.isArray(history) || !history.length) return false;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role === 'assistant') {
      return POST_FAILED_ASSISTANT_RE.test(normalizeText(m.content));
    }
    if (m?.role === 'user') break;
  }
  return false;
}

function isSchedulingContinuation(norm) {
  if (SCHEDULING_CONTINUATION_RE.test(norm)) return true;
  if (hasRescheduleSignal(norm)) return true;
  if (hasDateSignal(norm) && norm.length <= 40) return true;
  return false;
}

function isSchedulingInProgress(history) {
  if (!Array.isArray(history) || history.length === 0) return false;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role === 'assistant') {
      const content = normalizeText(m.content);
      return SCHEDULING_QUESTION_RE.test(content);
    }
    if (m?.role === 'user') break;
  }
  return false;
}

function isConfirmationUtterance(text) {
  const stripped = normalizeText(text).replace(/[!?.,;:]+$/g, '').trim();
  return /^(sim|pode|confirmo|esse horario|esse horário|isso|pode ser|pode confirmar|confirma|ok pode|isso mesmo|correto|perfeito|fechado)$/.test(stripped);
}

function hasAbortDismissSignal(norm) {
  return ABORT_DISMISS_RE.test(norm);
}

function hasFreshBookingSignal(norm) {
  return hasServiceSignal(norm)
    || hasDateSignal(norm)
    || hasProfessionalSignal(norm)
    || hasSchedulingAsk(norm)
    || isSimpleBookingBundle(norm);
}

function isDraftSchedulingContext(history) {
  if (isSchedulingInProgress(history)) return true;
  const historyNorm = (history || [])
    .filter((m) => m?.role === 'user')
    .map((m) => normalizeText(m.content))
    .join(' ');
  return hasServiceSignal(historyNorm) || hasDateSignal(historyNorm);
}

function hasMultipleIntents(norm) {
  let count = 0;
  if (hasPriceSignal(norm)) count++;
  if (hasDateSignal(norm)) count++;
  if (hasServiceSignal(norm)) count++;
  if (hasCancelSignal(norm) || hasRescheduleSignal(norm)) count++;
  return count >= 2;
}

const PRODUCT_TECHNIQUE_FAQ_RE = /\b(quais?\s+(tecnicas?|t[eé]cnicas?|produtos?)|qual\s+(produto|t[eé]cnica)|que\s+produto)\b/i;

function isProductTechniqueFaq(norm) {
  return PRODUCT_TECHNIQUE_FAQ_RE.test(norm);
}

/** Info-open (F1): só FAQ e PRICING respondem sem allow/claim. */
function isInfoOpenIntent(intent) {
  const i = String(intent || '');
  return i === INTENTS.FAQ || i === INTENTS.PRICING;
}

/**
 * PILOT claim: SCHEDULING só consome vaga com sinal explícito de marcar.
 * Não altera classifyTessIntent — filtro fino em tryClaim.
 */
function isPilotClaimableTurn({ intent, text }) {
  const intentStr = String(intent || '');
  const nonClaimable = [
    INTENTS.FAQ,
    INTENTS.TRIVIAL,
    INTENTS.PRICING,
    INTENTS.UNCERTAIN,
    INTENTS.HANDOFF_LIKELY,
  ];
  if (nonClaimable.includes(intentStr)) return false;
  if (intentStr === INTENTS.CANCEL || intentStr === INTENTS.RESCHEDULE) return true;
  if (intentStr !== INTENTS.SCHEDULING) return false;

  const norm = normalizeText(text);
  if (isProductTechniqueFaq(norm) && !hasSchedulingAsk(norm)) return false;
  if (hasSchedulingAsk(norm)) return true;
  if (isSimpleBookingBundle(norm)) return true;
  if (hasDateSignal(norm) && (hasServiceSignal(norm) || hasProfessionalSignal(norm))) return true;
  return false;
}

function classifyTessIntent(messageText, history = [], futureBookings = [], opts = {}) {
  const { lastBookingOutcome } = opts;
  const signals = [];
  const norm = normalizeText(messageText);
  const textLen = String(messageText || '').length;

  if (isMediaMessage(messageText)) {
    signals.push('media');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (isPostBookingFailedContext(history, lastBookingOutcome)) {
    if (hasFaqSignal(norm) && !hasServiceSignal(norm) && !hasDateSignal(norm) && !isSchedulingContinuation(norm)) {
      signals.push('post_failed', 'faq');
      return { intent: INTENTS.FAQ, confidence: 'high', signals };
    }
    if (isSchedulingContinuation(norm) || isConfirmationUtterance(messageText)) {
      signals.push('post_failed', 'continuation');
      return { intent: INTENTS.SCHEDULING, confidence: 'high', signals };
    }
  }

  if (hasAbortDismissSignal(norm)
    && !hasHandoffSignal(norm)
    && !hasRescheduleSignal(norm)
    && hasFreshBookingSignal(norm)) {
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['abort_then_booking'] };
  }

  if (textLen > 120) {
    if (isSimpleBookingBundle(norm) || hasSchedulingAsk(norm)) {
      signals.push('long_but_booking');
      return { intent: INTENTS.SCHEDULING, confidence: 'high', signals };
    }
    signals.push('long_message');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasPriceSignal(norm) && hasDateSignal(norm)) {
    signals.push('price_and_date');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasMultipleIntents(norm) && textLen > 50 && !isSimpleBookingBundle(norm)) {
    signals.push('multi_intent');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasHandoffSignal(norm)) {
    return { intent: INTENTS.HANDOFF_LIKELY, confidence: 'high', signals: ['handoff'] };
  }

  if (hasRescheduleSignal(norm)) {
    return { intent: INTENTS.RESCHEDULE, confidence: 'high', signals: ['reschedule'] };
  }

  const draftActive = isDraftSchedulingContext(history);
  const noFutureBookings = !Array.isArray(futureBookings) || futureBookings.length === 0;

  if (hasCancelSignal(norm)) {
    if (!noFutureBookings) {
      return { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel', 'future_bookings'] };
    }
    if (draftActive && hasAbortDismissSignal(norm)) {
      return { intent: INTENTS.FAQ, confidence: 'high', signals: ['abort_draft'] };
    }
    return { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel_no_bookings'] };
  }

  if (hasAbortDismissSignal(norm) && draftActive && noFutureBookings) {
    return { intent: INTENTS.FAQ, confidence: 'high', signals: ['abort_draft'] };
  }

  if (isSchedulingInProgress(history)) {
    if (hasFaqSignal(norm)) {
      return { intent: INTENTS.FAQ, confidence: 'high', signals: ['scheduling_in_progress', 'faq'] };
    }
    if (hasPriceSignal(norm)) {
      return { intent: INTENTS.PRICING, confidence: 'high', signals: ['scheduling_in_progress', 'price'] };
    }
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['scheduling_in_progress'] };
  }

  if (hasCompoundIntent(messageText)) {
    if (hasPriceSignal(norm)) {
      return { intent: INTENTS.PRICING, confidence: 'high', signals: ['compound', 'price'] };
    }
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['compound', 'booking'] };
  }

  if (isTrivialAllowlist(messageText) && (!history || history.length === 0)) {
    return { intent: INTENTS.TRIVIAL, confidence: 'high', signals: ['trivial_allowlist'] };
  }

  if (hasFaqSignal(norm) && !hasServiceSignal(norm) && !hasDateSignal(norm)) {
    return { intent: INTENTS.FAQ, confidence: 'high', signals: ['faq'] };
  }

  if (hasPriceSignal(norm)) {
    return { intent: INTENTS.PRICING, confidence: 'high', signals: ['price'] };
  }

  if (hasDateSignal(norm) || hasServiceSignal(norm) || hasProfessionalSignal(norm)) {
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] };
  }

  if (history?.length > 0 && isConfirmationUtterance(messageText)) {
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['confirmation'] };
  }

  if (hasSchedulingAsk(norm)) {
    return { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['scheduling_ask'] };
  }

  if ((textLen > 40 || hasMultipleIntents(norm)) && !isSimpleBookingBundle(norm)) {
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: ['ambiguous'] };
  }

  return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: ['unknown'] };
}

function shouldSkipTess({
  intent,
  confidence,
  history,
  messageText,
  isMedia,
  skipEnabled,
  trivialMaxChars = 80,
  isOwner = false,
}) {
  if (!skipEnabled) return false;
  if (isMedia || isMediaMessage(messageText)) return false;
  if (isOwner) return false;
  if (String(messageText || '').length > trivialMaxChars) return false;
  if (Array.isArray(history) && history.length > 0) return false;
  if (isSchedulingInProgress(history)) return false;
  if (intent !== INTENTS.TRIVIAL || confidence !== 'high') return false;
  if (!isTrivialAllowlist(messageText)) return false;
  if (hasCompoundIntent(messageText)) return false;
  const norm = normalizeText(messageText);
  if (hasServiceSignal(norm) || hasDateSignal(norm) || hasPriceSignal(norm)) return false;
  return true;
}

function trivialSkipResponse() {
  return 'Oi! 😊 Sou a recepcionista virtual do Studio Tirra. Como posso te ajudar hoje?';
}

module.exports = {
  INTENTS,
  PROFESSIONAL_RE,
  ROLE_RE,
  DATE_RE,
  PASSIVE_PERSIST_INTENTS,
  classifyTessIntent,
  intentToPersist,
  isTrivialAllowlist,
  shouldSkipTess,
  hasCompoundIntent,
  isSchedulingInProgress,
  isPostBookingFailedContext,
  isSchedulingContinuation,
  isConfirmationUtterance,
  isMediaMessage,
  isAudioTranscript,
  isIntentDenylist,
  isLeroUtterance,
  hasProfessionalSignal,
  isDurationHourToken,
  trivialSkipResponse,
  normalizeText,
  hasServiceSignal,
  hasDateSignal,
  hasPriceSignal,
  hasFaqSignal,
  hasAbortDismissSignal,
  hasFreshBookingSignal,
  isDraftSchedulingContext,
  hasSchedulingAsk,
  isSimpleBookingBundle,
  isPilotClaimableTurn,
  isInfoOpenIntent,
};
