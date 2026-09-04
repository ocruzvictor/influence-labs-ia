/**
 * Telemetria local de bytes/tokens do contexto TESS (S0 — zero créditos).
 * Evento grepável: tess.context_bytes
 */

function approxTokens(chars) {
  return Math.ceil(Math.max(0, Number(chars) || 0) / 4);
}

/**
 * Mede blocos individuais antes do payload completo.
 */
function measureContextBlocks(blocks = {}) {
  const keys = [
    'shell',
    'horarios',
    'servicos',
    'habilitacao',
    'profissionais',
    'historico',
    'future_bookings',
    'user_payload',
  ];
  const measured = {};
  let totalChars = 0;
  for (const key of keys) {
    const chars = String(blocks[key] || '').length;
    measured[key] = { chars, approx_tokens: approxTokens(chars) };
    totalChars += chars;
  }
  measured.total = { chars: totalChars, approx_tokens: approxTokens(totalChars) };
  return measured;
}

function logContextBytes({
  sessionId,
  intent,
  confidence,
  contextProfile,
  skippedTess,
  blocks,
  mode,
  traceId,
}) {
  const bytes = measureContextBlocks(blocks);
  const payload = {
    event: 'tess.context_bytes',
    sessionId: sessionId || null,
    intent: intent || null,
    confidence: confidence || null,
    context_profile: contextProfile || null,
    skipped_tess: Boolean(skippedTess),
    tess_context_mode: mode || 'full',
    trace_id: traceId || null,
    blocks: bytes,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
  return payload;
}

/**
 * Persiste o payload já medido em bot_operational_events.
 * Não inclui texto de bloco — só contagens. Fire-and-forget via emitOperationalEvent.
 */
async function persistContextBytesEvent(db, payload, clientPhone) {
  if (!db || !payload) return null;
  const { emitOperationalEvent } = require('./operational-events');
  const blocks = payload.blocks && typeof payload.blocks === 'object' ? payload.blocks : {};
  const safeBlocks = {};
  for (const [key, value] of Object.entries(blocks)) {
    if (value && typeof value === 'object') {
      safeBlocks[key] = {
        chars: Number(value.chars) || 0,
        approx_tokens: Number(value.approx_tokens) || 0,
      };
    }
  }
  await emitOperationalEvent(db, {
    event: 'tess.context_bytes',
    clientPhone,
    motivo: `${payload.intent || 'n/a'}:${payload.context_profile || 'n/a'}`,
    payload: {
      intent: payload.intent || null,
      confidence: payload.confidence || null,
      context_profile: payload.context_profile || null,
      skipped_tess: Boolean(payload.skipped_tess),
      tess_context_mode: payload.tess_context_mode || null,
      trace_id: payload.trace_id || null,
      blocks: safeBlocks,
      sessionId: payload.sessionId || null,
    },
  });
  return payload;
}

/**
 * Crédito do turno com dimensão (intent × perfil × chars). Não substitui o agregado diário.
 */
async function persistTessTurnEvent(db, {
  clientPhone,
  intent,
  confidence,
  contextProfile,
  tessCredits,
  skippedTess,
  totalChars,
  traceId,
  sessionId,
} = {}) {
  if (!db) return null;
  const { emitOperationalEvent } = require('./operational-events');
  const payload = {
    intent: intent || null,
    confidence: confidence || null,
    context_profile: contextProfile || null,
    tess_credits: tessCredits == null ? null : Number(tessCredits),
    skipped_tess: Boolean(skippedTess),
    total_chars: Number(totalChars) || 0,
    trace_id: traceId || null,
    sessionId: sessionId || null,
  };
  await emitOperationalEvent(db, {
    event: 'tess.turn',
    clientPhone,
    motivo: `${payload.intent || 'n/a'}:${payload.context_profile || 'n/a'}`,
    payload,
  });
  return payload;
}

module.exports = {
  approxTokens,
  measureContextBlocks,
  logContextBytes,
  persistContextBytesEvent,
  persistTessTurnEvent,
};
