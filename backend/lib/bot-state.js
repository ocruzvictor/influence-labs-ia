/**
 * bot-state — leitura cacheada de toggles e whitelist do Postgres.
 *
 * Usado por server.js antes de processar cada mensagem inbound do WhatsApp.
 * Substitui a leitura direta de BOT_ALLOWED_PHONES / BOT_ACCEPT_ALL env vars
 * implementada na Story 1.2-DATA (admin data layer core).
 *
 * Decisões de design (ver docs/dev-notes/story-1.2-DATA-preflight-decisions.md):
 *   • Cache lazy refresh (TTL 5s) — primeira chamada pós-expiração refaz queries
 *   • Fail-safe: se Postgres falhar/indisponível, retorna { toggles: null, whitelist: null }
 *     e o caller cai no BOT_ALLOWED_PHONES env (continuidade > consistência)
 *   • Whitelist vazia no DB também sinaliza fallback ao env (cutover seguro)
 */

const db = require('../db');

const CACHE_TTL_MS = 5_000;

let cache = { value: null, expiresAt: 0 };

/**
 * Reseta o cache. Use em testes ou após mutações conhecidas (admin API).
 * @returns {void}
 */
function invalidateCache() {
  cache = { value: null, expiresAt: 0 };
}

/**
 * Lê toggles + whitelist do Postgres com cache em memória.
 *
 * @returns {Promise<{ toggles: Object<string, boolean> | null, whitelist: Map<string, string> | null }>}
 *   • toggles: dict key→enabled. Ex: { global: true, 'feature:audio': true }
 *   • whitelist: Map phone→mode. Ex: Map { '5511...' => 'allow' }
 *   • Ambos null se DB indisponível ou erro → caller usa fallback legacy
 *   • whitelist Map vazio (size === 0) se DB OK mas tabela sem rows → caller também fallback
 */
async function getBotState() {
  if (cache.value && Date.now() < cache.expiresAt) {
    return cache.value;
  }

  const [togglesResult, whitelistResult] = await Promise.all([
    db.query('SELECT key, enabled FROM bot_toggles'),
    db.query('SELECT phone, mode FROM bot_whitelist'),
  ]);

  if (togglesResult === null || whitelistResult === null) {
    console.warn('[bot-state] DB unavailable — caller should fallback to env legacy');
    return { toggles: null, whitelist: null };
  }

  const toggles = Object.fromEntries(
    togglesResult.rows.map((r) => [r.key, r.enabled])
  );
  const whitelist = new Map(
    whitelistResult.rows.map((r) => [r.phone, r.mode])
  );

  const value = { toggles, whitelist };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

module.exports = { getBotState, invalidateCache, CACHE_TTL_MS };
