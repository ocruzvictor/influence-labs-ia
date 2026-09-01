/**
 * Resume falha TESS para log — sem dump do input (PII + contexto dinâmico).
 */

function summarizeFailedTessResponse(raw) {
  const body = raw && typeof raw === 'object' ? raw : {};
  const resp = Array.isArray(body.responses) ? body.responses[0] : null;
  const target = resp && typeof resp === 'object' ? resp : body;
  const error = firstString(
    target.error,
    target.message,
    target.reason,
    target.fail_reason,
    target.exception,
    body.error,
    body.message,
  );
  const input = target.input;
  return {
    template_id: body.template_id ?? null,
    response_id: target.id ?? null,
    status: target.status ?? body.status ?? null,
    error: error || null,
    input_chars: typeof input === 'string' ? input.length : 0,
    keys: Object.keys(target),
  };
}

function firstString(...candidates) {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && typeof value.message === 'string' && value.message.trim()) {
      return value.message.trim();
    }
  }
  return '';
}

module.exports = {
  summarizeFailedTessResponse,
};
