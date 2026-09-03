const {
  reserveTrinksRequest,
  finalizeTrinksRequest,
  saveProviderConsumption,
  getRequestBudget,
} = require('./trinks-usage');

function formatPayloadSummary(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (Array.isArray(payload.Errors) && payload.Errors.length) {
    return payload.Errors
      .map((e) => `${e.PropertyName}: ${e.ErrorMessage}`)
      .join('; ')
      .slice(0, 200);
  }
  const detail = payload.detail || payload.Message || payload.title;
  return detail ? String(detail).slice(0, 200) : '';
}

function sanitizeAgentMutationMetadata(origin, metadata = {}) {
  if (!String(origin || '').startsWith('agent_mutation_')) return null;
  const out = {};
  const phoneDigits = String(metadata.client_phone || '').replace(/\D/g, '');
  if (phoneDigits) out.client_phone = phoneDigits;
  if (metadata.kapso_conversation_id != null && metadata.kapso_conversation_id !== '') {
    out.kapso_conversation_id = String(metadata.kapso_conversation_id);
  }
  return out;
}

function createTrinksApi({
  db,
  baseUrl,
  apiKey,
  establishmentId,
  fetchImpl = fetch,
  timeoutMs = 12000,
  budget = 10000,
  operationalCap = 8500,
} = {}) {
  const base = String(baseUrl || 'https://api.trinks.com/v1').replace(/\/$/, '');
  if (!establishmentId) throw new Error('TRINKS_ESTABELECIMENTO_ID is required');

  async function canRequest({ essential, origin }) {
    const snapshot = await getRequestBudget(db, { budget, operationalCap });
    if (snapshot.mode === 'blocked') return { allowed: false, reason: 'monthly_cap', snapshot };
    if (snapshot.mode === 'essential_only' && !essential) return { allowed: false, reason: 'essential_only', snapshot };
    if (snapshot.mode === 'restricted' && String(origin).includes('snapshot')) {
      return { allowed: false, reason: 'restricted', snapshot };
    }
    return { allowed: true, snapshot };
  }

  async function request(path, {
    method = 'GET',
    body,
    origin = 'runtime',
    essential = false,
    headers = {},
    skipBudget = false,
    metadata = {},
  } = {}) {
    if (!skipBudget) {
      const gate = await canRequest({ essential, origin });
      if (!gate.allowed) {
        const err = new Error(`Trinks request blocked: ${gate.reason}`);
        err.code = 'TRINKS_BUDGET_BLOCKED';
        err.budget = gate.snapshot;
        throw err;
      }
    }
    const started = Date.now();
    let status = null;
    const isAgentMutation = String(origin).startsWith('agent_mutation_');
    let requestMetadata = isAgentMutation
      ? sanitizeAgentMutationMetadata(origin, metadata)
      : (() => {
        try {
          const url = new URL(path, base);
          return {
            page: url.searchParams.get('page') == null
              ? null
              : Number(url.searchParams.get('page')),
          };
        } catch (_) {
          return {};
        }
      })();
    const reservationId = await reserveTrinksRequest(db, {
      method,
      path,
      origin,
      operationalCap,
      metadata: requestMetadata,
    });
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          'X-Api-Key': apiKey,
          estabelecimentoId: String(establishmentId),
          accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = res.status;
      try {
        await finalizeTrinksRequest(db, reservationId, {
          status,
          consumed: status !== 429,
          latencyMs: Date.now() - started,
          metadata: requestMetadata,
        });
      } catch (finalizeError) {
        console.error('[trinks-api] resposta recebida, mas ledger nao finalizou:', finalizeError.message);
      }
      const text = await res.text();
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
      if (!res.ok) {
        const summary = formatPayloadSummary(payload);
        const err = new Error(`Trinks ${res.status}: ${path}${summary ? ` — ${summary}` : ''}`);
        err.status = res.status;
        err.payload = payload;
        err.retryAfter = res.headers.get('retry-after');
        throw err;
      }
      return payload;
    } catch (err) {
      if (status === null) {
        try {
          await finalizeTrinksRequest(db, reservationId, {
            status: null,
            consumed: false,
            latencyMs: Date.now() - started,
            metadata: isAgentMutation
              ? requestMetadata
              : { ...requestMetadata, error: err.message },
          });
        } catch (finalizeError) {
          console.error('[trinks-api] erro na requisicao, mas ledger nao finalizou:', finalizeError.message);
        }
      }
      throw err;
    }
  }

  async function refreshConsumption() {
    const payload = await request('/consumo', {
      origin: 'consumption_monitor',
      essential: true,
    });
    await saveProviderConsumption(db, payload);
    return payload;
  }

  return { request, refreshConsumption, canRequest };
}

module.exports = {
  createTrinksApi,
  formatPayloadSummary,
  sanitizeAgentMutationMetadata,
};
