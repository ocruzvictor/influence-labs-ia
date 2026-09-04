/**
 * Tetos de abort Tess por perfil (chão 6).
 * Puro — sem db, sem fetch.
 * SOT: docs/analysis/2026-09-04-aria-chao-6-timeout-tetos.md
 */

const { PROFILES } = require('./tess-context-profiles');

const DEFAULT_ABORT_MS = Object.freeze({
  MIN: 13000,
  FAQ: 13000,
  PRICE: 13000,
  CANCEL: 13000,
  BOOKING: 22000,
  FULL: 22000,
});

const TESS_TIMEOUT_WALL_MS = 25_000;
const TESS_ABORT_HARD_CEILING_MS = 24_000;

const ENV_ABORT_KEYS = Object.freeze({
  MIN: 'TESS_ABORT_MS_MIN',
  FAQ: 'TESS_ABORT_MS_FAQ',
  PRICE: 'TESS_ABORT_MS_PRICE',
  CANCEL: 'TESS_ABORT_MS_CANCEL',
  BOOKING: 'TESS_ABORT_MS_BOOKING',
  FULL: 'TESS_ABORT_MS_FULL',
});

const MIN_OVERRIDE_MS = 3000;

/**
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 */
function parseAbortCaps(env = process.env) {
  const caps = { ...DEFAULT_ABORT_MS };
  for (const [profile, envKey] of Object.entries(ENV_ABORT_KEYS)) {
    const raw = env[envKey];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number.parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= MIN_OVERRIDE_MS && n <= TESS_ABORT_HARD_CEILING_MS) {
      caps[profile] = n;
    }
  }
  return Object.freeze({ ...caps });
}

/**
 * @param {string} [profile]
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 * @returns {number}
 */
function resolveTessAbortMs(profile, env = process.env) {
  const caps = parseAbortCaps(env);
  const key = profile && caps[profile] != null ? profile : PROFILES.FULL;
  return caps[key] ?? caps[PROFILES.FULL] ?? DEFAULT_ABORT_MS.FULL;
}

module.exports = {
  DEFAULT_ABORT_MS,
  TESS_TIMEOUT_WALL_MS,
  TESS_ABORT_HARD_CEILING_MS,
  parseAbortCaps,
  resolveTessAbortMs,
};
