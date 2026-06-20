/**
 * Monitor de cota da API Trinks (story salon-whatsapp-trinks-quota-monitor).
 *
 * A Trinks limita por mês (5.000 base + adicionais R$60/+5.000, NÃO cumulativos).
 * DOIS processos consomem a mesma chave (backend bot + worker sync) → contador ÚNICO
 * no Postgres (tabela trinks_api_usage), ambos incrementam, /health lê.
 *
 * Granularidade DIÁRIA (chave = dia no fuso do salão): pega runaway no mesmo dia,
 * permite extrato dia-a-dia pra cruzar com a fatura Trinks (fim do ponto cego).
 * O total mensal é a soma dos dias do mês corrente.
 *
 * `db` é injetado (mesmo ./db dos 2 processos). nowFn injetável p/ testes.
 * recordTrinksCall é fire-and-forget (nunca quebra o hot-path nem o worker).
 */

function _parts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(date);
  const pick = t => p.find(x => x.type === t)?.value;
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

// 'YYYY-MM-DD' no fuso do salão (chave do contador diário).
function salonDayKey(date = new Date(), tz = 'America/Sao_Paulo') {
  const { y, m, d } = _parts(date, tz);
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM' no fuso do salão (cota reseta por mês).
function salonMonthKey(date = new Date(), tz = 'America/Sao_Paulo') {
  const { y, m } = _parts(date, tz);
  return `${y}-${m}`;
}

// Incrementa o contador do DIA corrente (+1 por chamada Trinks). Fire-and-forget.
function recordTrinksCall(db, nowFn = () => new Date()) {
  if (!db || typeof db.query !== 'function') return Promise.resolve();
  const day = salonDayKey(nowFn());
  return db.query(
    `INSERT INTO trinks_api_usage (day, used) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET used = trinks_api_usage.used + 1, updated_at = NOW()`,
    [day],
  ).catch((err) => { try { console.error('[trinks-usage] record falhou:', err.message); } catch (_) {} });
}

function normalizeEndpoint(path) {
  const raw = String(path || '/');
  return raw.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id');
}

async function recordTrinksRequest(db, {
  method = 'GET',
  path = '/',
  origin = 'unknown',
  status = null,
  consumed = null,
  latencyMs = null,
  metadata = null,
} = {}) {
  if (!db || typeof db.query !== 'function') return;
  const isConsumed = consumed === null ? (Number(status) > 0 && Number(status) !== 429) : Boolean(consumed);
  try {
    const saved = await db.query(
      `INSERT INTO trinks_api_requests
        (method, endpoint, origin, http_status, consumed, latency_ms, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        String(method || 'GET').toUpperCase(),
        normalizeEndpoint(path),
        String(origin || 'unknown'),
        status == null ? null : Number(status),
        isConsumed,
        latencyMs == null ? null : Math.max(0, Math.round(Number(latencyMs))),
        JSON.stringify(metadata || {}),
      ],
    );
    if (!saved) throw new Error('Postgres unavailable while persisting provider consumption');
  } catch (err) {
    try { console.error('[trinks-usage] request ledger falhou:', err.message); } catch (_) {}
  }
}

async function saveProviderConsumption(db, payload, nowFn = () => new Date()) {
  if (!db || typeof db.query !== 'function' || !payload) return;
  const total = Number(payload.cotaTotal);
  const used = Number(payload.totalUtilizado);
  const remaining = Number(payload.saldoRestante);
  const consistent = Number.isFinite(total)
    && Number.isFinite(used)
    && Number.isFinite(remaining)
    && total >= 0
    && used >= 0
    && remaining >= 0
    && used <= total
    && total - used === remaining;
  try {
    const localResult = await db.query(
      `SELECT COUNT(*)::int AS consumed
         FROM trinks_api_requests
        WHERE consumed
          AND requested_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
          AND requested_at < date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'`,
    );
    if (!localResult) throw new Error('Postgres unavailable while saving provider consumption');
    const localConsumed = Number(localResult.rows?.[0]?.consumed || 0);
    await db.query(
      `INSERT INTO trinks_consumption_snapshots
        (checked_at, plan_name, quota_total, total_used, remaining,
         local_consumed_at_check, consistent, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        nowFn(),
        payload.plano || null,
        Number.isFinite(total) ? total : null,
        Number.isFinite(used) ? used : null,
        Number.isFinite(remaining) ? remaining : null,
        localConsumed,
        consistent,
        JSON.stringify(payload),
      ],
    );
  } catch (err) {
    try { console.error('[trinks-usage] provider snapshot falhou:', err.message); } catch (_) {}
  }
}

async function getRequestBudget(db, {
  budget = 10000,
  operationalCap = 8500,
  nowFn = () => new Date(),
} = {}) {
  const month = salonMonthKey(nowFn());
  let localConsumed = 0;
  let attempts = 0;
  let rejected429 = 0;
  let provider = null;
  let unavailable = false;
  try {
    const local = await db.query(
      `SELECT COUNT(*)::int AS attempts,
              COUNT(*) FILTER (WHERE consumed)::int AS consumed,
              COUNT(*) FILTER (WHERE http_status = 429)::int AS rejected_429
         FROM trinks_api_requests
        WHERE requested_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
          AND requested_at < date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'`,
    );
    if (!local) throw new Error('Postgres unavailable while reading request budget');
    attempts = Number(local?.rows?.[0]?.attempts || 0);
    localConsumed = Number(local?.rows?.[0]?.consumed || 0);
    rejected429 = Number(local?.rows?.[0]?.rejected_429 || 0);
    const official = await db.query(
      `SELECT plan_name, quota_total, total_used, remaining,
              local_consumed_at_check, consistent, checked_at
         FROM trinks_consumption_snapshots
        WHERE checked_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
          AND checked_at < date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'
        ORDER BY checked_at DESC LIMIT 1`,
    );
    if (!official) throw new Error('Postgres unavailable while reading provider budget');
    provider = official?.rows?.[0] || null;
  } catch (err) {
    unavailable = true;
    provider = { error: err.message, consistent: false };
  }
  const providerUsed = provider?.consistent ? Number(provider.total_used || 0) : null;
  const providerBaseline = Number(provider?.local_consumed_at_check || 0);
  const effectiveUsed = providerUsed === null
    ? localConsumed
    : providerUsed + Math.max(0, localConsumed - providerBaseline);
  let mode = 'normal';
  if (unavailable || effectiveUsed >= operationalCap) mode = 'blocked';
  else if (effectiveUsed >= 8200) mode = 'essential_only';
  else if (effectiveUsed >= 7500) mode = 'restricted';
  else if (effectiveUsed >= 6000) mode = 'warning';
  else if (provider && provider.consistent === false) mode = 'warning';
  return {
    month,
    budget,
    operational_cap: operationalCap,
    attempts,
    local_consumed: localConsumed,
    rejected_429: rejected429,
    provider,
    unavailable,
    effective_used: effectiveUsed,
    remaining_to_cap: Math.max(0, operationalCap - effectiveUsed),
    mode,
  };
}

async function reserveTrinksRequest(db, {
  method = 'GET',
  path = '/',
  origin = 'unknown',
  operationalCap = 8500,
  metadata = null,
} = {}) {
  // Reserve quota pessimistically before the external call. Every caller must
  // finalize the row, including timeout, transport error, and 429 paths.
  if (!db || typeof db.query !== 'function') throw new Error('Postgres unavailable for Trinks budget');
  const result = await db.query(
    `WITH lock AS (
       SELECT pg_advisory_xact_lock(hashtext('trinks_api_monthly_budget'))
     ), local_usage AS (
       SELECT COUNT(*)::int AS consumed
         FROM trinks_api_requests, lock
        WHERE consumed
          AND requested_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
          AND requested_at < date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'
     ), official AS (
       SELECT total_used, local_consumed_at_check
         FROM trinks_consumption_snapshots
        WHERE consistent
          AND checked_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
          AND checked_at < date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'
        ORDER BY checked_at DESC
        LIMIT 1
     ), effective AS (
       SELECT CASE
         WHEN official.total_used IS NULL THEN local_usage.consumed
         ELSE official.total_used + GREATEST(
           0,
           local_usage.consumed - COALESCE(official.local_consumed_at_check, 0)
         )
       END AS used
       FROM local_usage LEFT JOIN official ON TRUE
     )
     INSERT INTO trinks_api_requests
       (method, endpoint, origin, consumed, metadata)
     SELECT $1, $2, $3, TRUE, $4::jsonb
       FROM effective
      WHERE used < $5
     RETURNING id`,
    [
      String(method || 'GET').toUpperCase(),
      normalizeEndpoint(path),
      String(origin || 'unknown'),
      JSON.stringify(metadata || {}),
      operationalCap,
    ],
  );
  if (!result) throw new Error('Postgres unavailable while reserving Trinks request');
  const id = result.rows?.[0]?.id;
  if (!id) {
    const err = new Error('Trinks request blocked: monthly_cap');
    err.code = 'TRINKS_BUDGET_BLOCKED';
    throw err;
  }
  return id;
}

async function finalizeTrinksRequest(db, id, {
  status = null,
  consumed,
  latencyMs = null,
  metadata = null,
} = {}) {
  // Use consumed=false when Trinks did not process the request and for 429.
  if (typeof consumed !== 'boolean') {
    throw new Error('consumed must be explicitly set when finalizing a Trinks request');
  }
  const result = await db.query(
    `UPDATE trinks_api_requests
        SET http_status = $2,
            consumed = $3,
            latency_ms = $4,
            metadata = metadata || $5::jsonb
      WHERE id = $1
      RETURNING id`,
    [
      id,
      status == null ? null : Number(status),
      Boolean(consumed),
      latencyMs == null ? null : Math.max(0, Math.round(Number(latencyMs))),
      JSON.stringify(metadata || {}),
    ],
  );
  if (!result?.rows?.length) throw new Error('Postgres unavailable while finalizing Trinks request');
}

// Snapshot da cota do mês corrente (soma dos dias) + consumo de hoje. budget = limite contratado.
async function getTrinksUsage(db, budget, nowFn = () => new Date()) {
  const month = salonMonthKey(nowFn());
  const today = salonDayKey(nowFn());
  let used = 0, usedToday = 0;
  try {
    const r = await db.query(
      `SELECT COALESCE(SUM(used), 0) AS used,
              COALESCE(SUM(used) FILTER (WHERE day = $2), 0) AS today
         FROM trinks_api_usage
        WHERE to_char(day, 'YYYY-MM') = $1`,
      [month, today],
    );
    used = Number(r?.rows?.[0]?.used ?? 0);
    usedToday = Number(r?.rows?.[0]?.today ?? 0);
  } catch (err) {
    try { console.error('[trinks-usage] read falhou:', err.message); } catch (_) {}
  }
  const remaining = Math.max(0, budget - used);
  const pct = budget > 0 ? Math.round((used / budget) * 1000) / 1000 : 0;
  return { month, today, used, used_today: usedToday, budget, remaining, pct };
}

// Quais thresholds (ex: [0.8,0.9,1.0]) foram cruzados e ainda não alertados neste mês.
function newlyCrossed(pct, thresholds, alreadyAlerted) {
  const done = alreadyAlerted instanceof Set ? alreadyAlerted : new Set(alreadyAlerted || []);
  return thresholds.filter(t => pct >= t && !done.has(t));
}

module.exports = {
  salonDayKey,
  salonMonthKey,
  recordTrinksCall,
  recordTrinksRequest,
  reserveTrinksRequest,
  finalizeTrinksRequest,
  saveProviderConsumption,
  getRequestBudget,
  getTrinksUsage,
  newlyCrossed,
  normalizeEndpoint,
};
