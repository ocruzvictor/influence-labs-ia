/**
 * Classificador determinístico de intenção — hot-path TESS (sem LLM extra).
 * Fallback conservador: UNCERTAIN ou confidence !== 'high' → perfil FULL.
 */

const { IMAGE_MARKER, STICKER_MARKER } = require('./kapso-media');

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

const PRICE_RE = /\b(quanto|preco|preço|valor|custa|custo|quanto\s+fica)\b/i;
const FAQ_RE = /\b(endereco|endereço|onde fica|estacionamento|pix|pagamento|formas de pagamento|horario de funcionamento|horário de funcionamento|funcionamento|como chegar)\b/i;
const CANCEL_RE = /\b(cancela|cancelar|cancel|desmarc|desmarquei|nao vou|não vou)\b/i;
const RESCHEDULE_RE = /\b(remarc|mudar horario|mudar horário|trocar horario|trocar horário|outro horario|outro horário)\b/i;
const HANDOFF_RE = /\b(falar com|humano|gabriel|atendente|pessoa real)\b/i;
const DATE_RE = /\b(amanha|amanhã|hoje|tarde|noite|segunda|terca|terça|quarta|quinta|sext[ao]|sabado|sábado|domingo|\d{1,2}[\/\-]\d{1,2}|\d{1,2}h|\d{1,2}:\d{2})\b/i;
const PROFESSIONAL_RE = /\b(tiago|andre|andré|erick|fefe|fernanda|gi\b|giovanna|claudia|cláudia|bruuna|bruna)\b/i;

const SERVICE_KEYWORDS = [
  'cort', 'barba', 'mecha', 'escova', 'color', 'camuflag', 'progressiva', 'hidrat',
  'manicure', 'pedicure', 'sobrancelha', 'cilio', 'cílio', 'depil', 'limpeza de pele',
  'maquiagem', 'make', 'penteado', 'laser', 'botox', 'cauteriz', 'tonaliz',
];

const SCHEDULING_QUESTION_RE = /\b(horario|horário|qual servico|qual serviço|qual dia|qual data|que horas|prefere|escolhe|confirma|profissional|disponivel|disponível)\b/i;

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

function hasServiceSignal(norm) {
  return SERVICE_KEYWORDS.some((kw) => norm.includes(kw));
}

function hasPriceSignal(norm) {
  return PRICE_RE.test(norm);
}

function hasDateSignal(norm) {
  return DATE_RE.test(norm);
}

function hasProfessionalSignal(norm) {
  return PROFESSIONAL_RE.test(norm);
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

function isTrivialAllowlist(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  if (TRIVIAL_EXACT.has(norm)) return true;
  if (/^obrigad/.test(norm) && norm.length <= 14) return true;
  if ((norm === 'tudo bem' || norm === 'td bem') && !norm.includes('?')) return true;
  return false;
}

function hasCompoundIntent(messageText) {
  const norm = normalizeText(messageText);
  if (/^(oi|ola|olá|oie|bom dia|boa tarde|boa noite)\s+\S/.test(norm)) return true;
  if (hasServiceSignal(norm) || hasDateSignal(norm) || hasPriceSignal(norm)) return true;
  if (hasProfessionalSignal(norm)) return true;
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

function hasMultipleIntents(norm) {
  let count = 0;
  if (hasPriceSignal(norm)) count++;
  if (hasDateSignal(norm)) count++;
  if (hasServiceSignal(norm)) count++;
  if (hasCancelSignal(norm) || hasRescheduleSignal(norm)) count++;
  return count >= 2;
}

function classifyTessIntent(messageText, history = [], futureBookings = []) {
  const signals = [];
  const norm = normalizeText(messageText);
  const textLen = String(messageText || '').length;

  if (isMediaMessage(messageText)) {
    signals.push('media');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (textLen > 120) {
    signals.push('long_message');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasPriceSignal(norm) && hasDateSignal(norm)) {
    signals.push('price_and_date');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasMultipleIntents(norm) && textLen > 50) {
    signals.push('multi_intent');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (hasHandoffSignal(norm)) {
    return { intent: INTENTS.HANDOFF_LIKELY, confidence: 'high', signals: ['handoff'] };
  }

  if (hasRescheduleSignal(norm)) {
    return { intent: INTENTS.RESCHEDULE, confidence: 'high', signals: ['reschedule'] };
  }

  if (hasCancelSignal(norm)) {
    if (Array.isArray(futureBookings) && futureBookings.length > 0) {
      return { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel', 'future_bookings'] };
    }
    signals.push('cancel_no_bookings');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
  }

  if (isSchedulingInProgress(history)) {
    signals.push('scheduling_in_progress');
    return { intent: INTENTS.UNCERTAIN, confidence: 'low', signals };
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

  if (history?.length > 0 && /^(sim|pode|confirmo|esse horario|esse horário|isso|pode ser)$/.test(norm)) {
    return { intent: INTENTS.SCHEDULING, confidence: 'medium', signals: ['confirmation'] };
  }

  if (textLen > 40 || hasMultipleIntents(norm)) {
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
  classifyTessIntent,
  isTrivialAllowlist,
  shouldSkipTess,
  hasCompoundIntent,
  isSchedulingInProgress,
  isMediaMessage,
  trivialSkipResponse,
  normalizeText,
  hasServiceSignal,
  hasDateSignal,
  hasPriceSignal,
};
