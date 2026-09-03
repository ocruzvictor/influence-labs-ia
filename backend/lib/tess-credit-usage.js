/**
 * Monitor de créditos TESS (story tess-context-on-demand).
 *
 * Contador local (tess_credit_usage_daily) continua para telemetria do bot.
 * Saldo e consumo da CONTA vêm da API TESS — nunca inventar remaining via
 * TESS_CREDIT_BUDGET − used local (isso avisava ~400 com ~900 na carteira).
 *
 * `db` injetado (./db). nowFn / fetchFn injetáveis p/ testes.
 */

const { salonDayKey, newlyCrossed } = require('./trinks-usage');

const ACCOUNT_CACHE_MS = 60 * 1000;
const REMAINING_KEYS = new Set([
  'credits_remaining',
  'remaining_credits',
  'available_credits',
  'credits_available',
  'wallet_balance',
  'credit_balance',
  'current_credits',
  'credits_current',
  'balance',
  'remaining',
  'remainingCredits',
  'availableCredits',
  'creditsRemaining',
  'creditsAvailable',
  'walletBalance',
  'creditBalance',
  'currentCredits',
]);
const WALLET_BUCKET_KEYS = [
  'monthly_credits',
  'purchased_credits',
  'extra_credits',
  'bonus_credits',
  'monthlyCredits',
  'purchasedCredits',
  'extraCredits',
  'bonusCredits',
];
const SKIP_WALK_KEYS = new Set(['items', 'executions', 'history', 'pagination']);

let _accountCache = { at: 0, value: null };

function toCreditNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e7) return null;
  return n;
}

function walletBucketSum(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  let sum = 0;
  let found = 0;
  for (const key of WALLET_BUCKET_KEYS) {
    const n = toCreditNumber(obj[key]);
    if (n == null) continue;
    sum += n;
    found += 1;
  }
  return found >= 1 ? sum : null;
}

function isBillingContext(parentKey) {
  return /wallet|credit|subscription|billing|account/i.test(parentKey || '');
}

/**
 * Extrai remaining da carteira. Ignora items[] de GET /workspaces/usage
 * (credits por execução, ~10–40 cr, não é o saldo da conta).
 */
function extractAccountRemaining(payload, depth = 0, parentKey = '') {
  if (payload == null || depth > 6) return null;
  if (typeof payload !== 'object') return toCreditNumber(payload);

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractAccountRemaining(item, depth + 1, parentKey);
      if (found != null) return found;
    }
    return null;
  }

  const billing = depth === 0 || isBillingContext(parentKey);
  for (const key of Object.keys(payload)) {
    if (!REMAINING_KEYS.has(key)) continue;
    if (key === 'balance' && !billing) continue;
    const n = toCreditNumber(payload[key]);
    if (n != null) return n;
  }

  const buckets = walletBucketSum(payload);
  if (buckets != null) return buckets;

  for (const [key, value] of Object.entries(payload)) {
    if (SKIP_WALK_KEYS.has(key)) continue;
    if (value && typeof value === 'object') {
      const found = extractAccountRemaining(value, depth + 1, key);
      if (found != null) return found;
    }
  }
  return null;
}

function usageItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function usageHasMore(payload) {
  return Boolean(payload?.pagination?.has_more || payload?.data?.pagination?.has_more);
}

function sumUsageCredits(payload) {
  return usageItems(payload).reduce((sum, item) => {
    const n = Number(item?.credits);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

function joinUrl(apiBase, path) {
  const base = String(apiBase || 'https://api.tess.im').replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function fetchJson(fetchFn, url, headers, timeoutMs = 15000) {
  const res = await fetchFn(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text().catch(() => '');
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
  return { ok: res.ok, status: res.status, body };
}

async function fetchWorkspaceUsageCredits({
  fetchFn,
  headers,
  apiBase,
  day,
  maxPages = 15,
} = {}) {
  let used = 0;
  let pages = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = joinUrl(apiBase, `/workspaces/usage?start_date=${encodeURIComponent(day)}&end_date=${encodeURIComponent(day)}&page=${page}&per_page=100`);
    const { ok, status, body } = await fetchJson(fetchFn, url, headers);
    pages += 1;
    if (!ok) {
      throw new Error(`TESS usage HTTP ${status}`);
    }
    used += sumUsageCredits(body);
    const remainingOnPayload = extractAccountRemaining(body);
    if (!usageHasMore(body)) {
      return { used, remaining: remainingOnPayload, pages };
    }
  }
  return { used, remaining: null, pages };
}

async function fetchAccountRemaining({
  fetchFn,
  headers,
  apiBase,
  remainingPaths = [],
} = {}) {
  const paths = (remainingPaths || []).filter(Boolean);
  for (const path of paths) {
    try {
      const { ok, body } = await fetchJson(fetchFn, joinUrl(apiBase, path), headers);
      if (!ok || body == null) continue;
      const remaining = extractAccountRemaining(body);
      if (remaining != null) return { remaining, path };
    } catch (_) {
      // próximo path — 404/429/timeout não derruba o check
    }
  }
  return { remaining: null, path: null };
}

/**
 * Snapshot da conta TESS: used hoje (usage API) + remaining da carteira.
 * Cache ~60s (mesmo TTL da listagem TESS).
 */
async function fetchTessAccountSnapshot({
  fetchFn = globalThis.fetch,
  authHeaders,
  apiBase,
  workspaceId,
  day,
  nowMs = Date.now(),
  cacheMs = ACCOUNT_CACHE_MS,
  remainingPaths = [],
} = {}) {
  if (!fetchFn || typeof fetchFn !== 'function') return null;
  if (!authHeaders || !day) return null;
  if (_accountCache.value && nowMs - _accountCache.at < cacheMs) {
    return _accountCache.value;
  }

  const headers = {
    ...authHeaders,
    Accept: 'application/json',
  };

  let used = null;
  let remaining = null;
  let remainingPath = null;
  try {
    const usage = await fetchWorkspaceUsageCredits({ fetchFn, headers, apiBase, day });
    used = usage.used;
    remaining = usage.remaining;
  } catch (err) {
    try { console.error('[tess-credits] usage API falhou:', err.message); } catch (_) {}
  }

  // API pública TESS (VPS 2026-09-01): /wallet /credits /subscriptions = 404.
  // Só sonda paths explícitos (TESS_CREDIT_REMAINING_PATHS) para não 429.
  if (remaining == null && remainingPaths.length) {
    const wallet = await fetchAccountRemaining({
      fetchFn, headers, apiBase, workspaceId, remainingPaths,
    });
    remaining = wallet.remaining;
    remainingPath = wallet.path;
  }

  const value = {
    used,
    remaining,
    source: remaining != null ? (remainingPath || 'account') : (used != null ? 'usage' : null),
  };
  _accountCache = { at: nowMs, value };
  return value;
}

function resetTessAccountCache() {
  _accountCache = { at: 0, value: null };
}

function mergeAccountUsage(local, account, numericBudget) {
  const accountUsed = account?.used == null ? null : Number(account.used);
  const accountRemaining = account?.remaining == null ? null : Number(account.remaining);
  const remainingSource = accountRemaining != null ? 'account' : 'local_budget';
  const remaining = accountRemaining != null
    ? Math.max(0, accountRemaining)
    : Math.max(0, numericBudget - local.credits_used);
  const usedForPct = accountUsed != null ? accountUsed : local.credits_used;
  const pct = numericBudget > 0 ? Math.round((usedForPct / numericBudget) * 1000) / 1000 : 0;
  return {
    ...local,
    budget: numericBudget,
    pct,
    remaining,
    remaining_source: remainingSource,
    account_used: Number.isFinite(accountUsed) ? accountUsed : null,
    account_remaining: Number.isFinite(accountRemaining) ? accountRemaining : null,
    account_source: account?.source || null,
  };
}

// Incrementa créditos e chamadas do DIA corrente. Fire-and-forget.
// credits null/undefined → no-op (caller usa ?? 0 para skips com 0 cr).
function recordTessCredits(db, credits, nowFn = () => new Date()) {
  if (credits == null) return Promise.resolve();
  if (!db || typeof db.query !== 'function') return Promise.resolve();
  const amount = Math.max(0, Number(credits) || 0);
  const day = salonDayKey(nowFn());
  return db.query(
    `INSERT INTO tess_credit_usage_daily (day, credits_used, calls)
     VALUES ($1::date, $2, 1)
     ON CONFLICT (day) DO UPDATE SET
       credits_used = tess_credit_usage_daily.credits_used + EXCLUDED.credits_used,
       calls = tess_credit_usage_daily.calls + 1,
       updated_at = NOW()`,
    [day, amount],
  ).catch((err) => { try { console.error('[tess-credits] record falhou:', err.message); } catch (_) {} });
}

async function readLocalUsage(db, day) {
  let credits_used = 0;
  let calls = 0;
  let alerted_thresholds = [];
  try {
    const r = await db.query(
      `SELECT credits_used, calls, alerted_thresholds
         FROM tess_credit_usage_daily
        WHERE day = $1::date`,
      [day],
    );
    credits_used = Number(r?.rows?.[0]?.credits_used ?? 0);
    calls = Number(r?.rows?.[0]?.calls ?? 0);
    const raw = r?.rows?.[0]?.alerted_thresholds;
    if (Array.isArray(raw)) alerted_thresholds = raw.map(Number).filter(Number.isFinite);
    else if (typeof raw === 'string') {
      try { alerted_thresholds = JSON.parse(raw).map(Number).filter(Number.isFinite); } catch (_) {}
    }
  } catch (err) {
    if (String(err.message || '').includes('alerted_thresholds')) {
      try {
        const r = await db.query(
          `SELECT credits_used, calls
             FROM tess_credit_usage_daily
            WHERE day = $1::date`,
          [day],
        );
        credits_used = Number(r?.rows?.[0]?.credits_used ?? 0);
        calls = Number(r?.rows?.[0]?.calls ?? 0);
      } catch (inner) {
        try { console.error('[tess-credits] read falhou:', inner.message); } catch (_) {}
      }
    } else {
      try { console.error('[tess-credits] read falhou:', err.message); } catch (_) {}
    }
  }
  return { day, credits_used, calls, alerted_thresholds };
}

// Snapshot do dia corrente + saldo da conta TESS quando a API responde.
async function getTessCreditUsage(db, budget, nowFn = () => new Date(), opts = {}) {
  const day = salonDayKey(nowFn());
  const local = await readLocalUsage(db, day);
  const numericBudget = Number(budget) || 0;
  let account = null;
  if (typeof opts.accountFetcher === 'function') {
    try {
      account = await opts.accountFetcher(day);
    } catch (err) {
      try { console.error('[tess-credits] account snapshot falhou:', err.message); } catch (_) {}
    }
  }
  const merged = mergeAccountUsage(local, account, numericBudget);
  return merged;
}

function newlyDropped(remaining, thresholds, alreadyAlerted) {
  const done = alreadyAlerted instanceof Set ? alreadyAlerted : new Set(alreadyAlerted || []);
  const n = Number(remaining);
  if (!Number.isFinite(n)) return [];
  return thresholds.filter((t) => n <= t && !done.has(t));
}

async function saveCreditAlertState(db, {
  day,
  alertedThresholds,
  accountUsed = null,
  accountRemaining = null,
} = {}) {
  if (!db || typeof db.query !== 'function' || !day) return;
  const alerted = JSON.stringify(
    [...new Set((alertedThresholds || []).map(Number).filter(Number.isFinite))],
  );
  try {
    await db.query(
      `INSERT INTO tess_credit_usage_daily (day, credits_used, calls, alerted_thresholds, account_used, account_remaining)
       VALUES ($1::date, 0, 0, $2::jsonb, $3, $4)
       ON CONFLICT (day) DO UPDATE SET
         alerted_thresholds = EXCLUDED.alerted_thresholds,
         account_used = EXCLUDED.account_used,
         account_remaining = EXCLUDED.account_remaining,
         updated_at = NOW()`,
      [day, alerted, accountUsed, accountRemaining],
    );
  } catch (err) {
    try { console.error('[tess-credits] persist alerta falhou:', err.message); } catch (_) {}
  }
}

function formatTessCreditAlert({ day, accountRemaining, accountUsed, calls, threshold }) {
  const remainingLabel = Number(accountRemaining).toFixed(2);
  const usedLabel = accountUsed == null ? 'n/d' : Number(accountUsed).toFixed(2);
  return `Alerta creditos TESS (${day}): restam ${remainingLabel} na conta (carteira TESS). `
    + `Usados hoje (API): ${usedLabel}. Chamadas locais hoje: ${calls}. Limiar remaining: ${threshold}.`;
}

module.exports = {
  salonDayKey,
  recordTessCredits,
  getTessCreditUsage,
  newlyCrossed,
  newlyDropped,
  extractAccountRemaining,
  sumUsageCredits,
  fetchTessAccountSnapshot,
  resetTessAccountCache,
  saveCreditAlertState,
  formatTessCreditAlert,
  mergeAccountUsage,
};
