const { INTENTS } = require('./tess-context-intent');

const CANCEL_TIMEOUT_COPY =
  'Não consegui cancelar agora 😕 Seu horário não foi alterado. Tente novamente em instantes.';
const DEFAULT_TIMEOUT_COPY =
  'Não consegui processar sua mensagem agora 😕 Não alterei seu agendamento. Tente novamente em instantes.';

function isTessTimeoutError(error) {
  const candidates = [error, error?.cause].filter(Boolean);
  return candidates.some((candidate) => {
    const name = String(candidate?.name || '');
    const code = String(candidate?.code || '');
    const message = String(candidate?.message || '');
    return name === 'TimeoutError'
      || name === 'AbortError'
      || code === 'UND_ERR_ABORTED'
      || /\b(?:abort(?:ed|ing)?|timed?\s*out|timeout)\b/i.test(message);
  });
}

function buildTessTimeoutResponse(intent) {
  return intent === INTENTS.CANCEL ? CANCEL_TIMEOUT_COPY : DEFAULT_TIMEOUT_COPY;
}

function createTessTimeoutResult(intent) {
  const response = buildTessTimeoutResponse(intent);
  return {
    response,
    responses: [response],
    timestamp: new Date().toISOString(),
  };
}

function createTessTimeoutEvent({
  clientPhone = null,
  kapsoConversationId = null,
  intent = null,
  contextProfile = null,
  timeoutMs = null,
} = {}) {
  return {
    event: 'tess.timeout',
    clientPhone,
    kapsoConversationId,
    payload: {
      intent,
      contextProfile,
      timeout_ms: timeoutMs,
    },
  };
}

module.exports = {
  CANCEL_TIMEOUT_COPY,
  DEFAULT_TIMEOUT_COPY,
  isTessTimeoutError,
  buildTessTimeoutResponse,
  createTessTimeoutResult,
  createTessTimeoutEvent,
};
