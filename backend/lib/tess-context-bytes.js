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
  contextProfile,
  skippedTess,
  blocks,
  mode,
}) {
  const bytes = measureContextBlocks(blocks);
  const payload = {
    event: 'tess.context_bytes',
    sessionId: sessionId || null,
    intent: intent || null,
    context_profile: contextProfile || null,
    skipped_tess: Boolean(skippedTess),
    tess_context_mode: mode || 'full',
    blocks: bytes,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
  return payload;
}

module.exports = {
  approxTokens,
  measureContextBlocks,
  logContextBytes,
};
