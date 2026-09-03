/**
 * Feature flags — TESS context-on-demand (Story tess-context-on-demand).
 * Default 2026-09-03 (Victor): MODE=scoped. Rollback: TESS_CONTEXT_MODE=full
 * ou TESS_CONTEXT_FORCE_FULL=1. Skip trivial continua OFF.
 */

function parseTessContextConfig(env = process.env) {
  const modeRaw = String(env.TESS_CONTEXT_MODE || 'scoped').trim().toLowerCase();
  const mode = modeRaw === 'full' ? 'full' : 'scoped';
  const forceFull = env.TESS_CONTEXT_FORCE_FULL === '1';
  const skipTrivial = env.TESS_SKIP_TRIVIAL === 'true';
  const trivialMaxChars = Math.max(1, parseInt(env.TESS_TRIVIAL_MAX_CHARS || '80', 10) || 80);
  const effectiveMode = forceFull ? 'full' : mode;
  return { mode, forceFull, skipTrivial, trivialMaxChars, effectiveMode };
}

module.exports = {
  parseTessContextConfig,
};
