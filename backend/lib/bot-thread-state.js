/**
 * bot-thread-state — persistência de silêncio pós-handoff / takeover Business App.
 *
 * Substitui o Map humanHandledUntil em server.js (Story resume-ia-1).
 * Cache por phone TTL 5s — separado do scan global de bot-state.js.
 *
 * Fail-open em leitura se Postgres indisponível (bot continua respondendo).
 */

const db = require('../db');
const { digitsOnly, isOwnerPhone } = require('./owner-access');

const CACHE_TTL_MS = 5_000;

/** @type {Map<string, { silencedUntilMs: number | null, expiresAt: number }>} */
const cache = new Map();

/**
 * @param {string} phone
 * @returns {void}
 */
function invalidatePhoneCache(phone) {
  const digits = digitsOnly(phone);
  if (digits) cache.delete(digits);
}

/**
 * Limpa todo o cache (testes).
 * @returns {void}
 */
function resetCacheForTests() {
  cache.clear();
}

/**
 * @param {number | null | undefined} silencedUntilMs
 * @returns {boolean}
 */
function isSilencedActive(silencedUntilMs) {
  if (silencedUntilMs == null) return false;
  return Date.now() < silencedUntilMs;
}

/**
 * @param {string} phone
 * @returns {Promise<{ silencedUntilMs: number | null } | null>}
 */
async function loadFromDb(phone) {
  const result = await db.query(
    'SELECT silenced_until FROM bot_thread_state WHERE phone = $1',
    [phone],
  );
  if (!result) return null;
  if (!result.rows.length) return { silencedUntilMs: null };
  const raw = result.rows[0].silenced_until;
  return {
    silencedUntilMs: raw ? new Date(raw).getTime() : null,
  };
}

/**
 * Marca thread como human-handled (persiste silenced_until + silence_reason).
 *
 * @param {string} phone
 * @param {'handoff' | 'business_app'} reason
 * @param {{ ttlMs?: number }} [opts]
 * @returns {Promise<void>}
 */
async function markHumanHandled(phone, reason, { ttlMs } = {}) {
  const digits = digitsOnly(phone);
  if (!digits) return;
  if (isOwnerPhone(digits)) return;

  const safeReason = reason === 'business_app' ? 'business_app' : 'handoff';
  const ms = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : 6 * 60 * 60 * 1000;
  const silencedUntil = new Date(Date.now() + ms);

  invalidatePhoneCache(digits);

  const result = await db.query(
    `INSERT INTO bot_thread_state (phone, silenced_until, silence_reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET
       silenced_until = EXCLUDED.silenced_until,
       silence_reason = EXCLUDED.silence_reason`,
    [digits, silencedUntil.toISOString(), safeReason],
  );

  if (result) {
    cache.set(digits, {
      silencedUntilMs: silencedUntil.getTime(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    console.log(
      `[bot-thread-state] ${digits} → HUMAN-HANDLED (${safeReason}) ate ${silencedUntil.toISOString()}`,
    );
  } else {
    console.warn(`[bot-thread-state] falha ao persistir silencio para ${digits}`);
  }
}

/**
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
async function isHumanHandled(phone) {
  const digits = digitsOnly(phone);
  if (!digits) return false;
  if (isOwnerPhone(digits)) return false;

  const cached = cache.get(digits);
  if (cached && Date.now() < cached.expiresAt) {
    return isSilencedActive(cached.silencedUntilMs);
  }

  const row = await loadFromDb(digits);
  if (row === null) {
    console.warn('[bot-thread-state] DB unavailable — isHumanHandled fail-open (false)');
    return false;
  }

  cache.set(digits, {
    silencedUntilMs: row.silencedUntilMs,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return isSilencedActive(row.silencedUntilMs);
}

/**
 * COUNT(*) de threads com silêncio ativo (health).
 *
 * @returns {Promise<number | null>} null se DB/tabela indisponível
 */
async function countActiveSilenced() {
  const result = await db.query(
    'SELECT COUNT(*)::int AS cnt FROM bot_thread_state WHERE silenced_until > NOW()',
  );
  if (!result?.rows?.[0]) return null;
  return result.rows[0].cnt;
}

/**
 * Persiste timestamp de outbound staff (origin != cloud_api) para gate human_spoke_recently.
 *
 * @param {string} phone
 * @returns {Promise<void>}
 */
async function persistStaffOutbound(phone) {
  const digits = digitsOnly(phone);
  if (!digits || isOwnerPhone(digits)) return;

  invalidatePhoneCache(digits);

  const result = await db.query(
    `INSERT INTO bot_thread_state (phone, last_staff_outbound_at)
     VALUES ($1, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       last_staff_outbound_at = NOW()`,
    [digits],
  );

  if (!result) {
    console.warn(`[bot-thread-state] falha ao persistir last_staff_outbound_at para ${digits}`);
  }
}

module.exports = {
  CACHE_TTL_MS,
  invalidatePhoneCache,
  resetCacheForTests,
  markHumanHandled,
  isHumanHandled,
  countActiveSilenced,
  persistStaffOutbound,
};
