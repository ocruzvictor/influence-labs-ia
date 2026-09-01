/**
 * Feature flags — TESS context-on-demand (Story tess-context-on-demand).
 * Default safe: MODE=full, SKIP=false.
 */

function parseTessContextConfig(env = process.env) {
  const modeRaw = String(env.TESS_CONTEXT_MODE || 'full').trim().toLowerCase();
  const mode = modeRaw === 'scoped' ? 'scoped' : 'full';
  const forceFull = env.TESS_CONTEXT_FORCE_FULL === '1';
  const skipTrivial = env.TESS_SKIP_TRIVIAL === 'true';
  const trivialMaxChars = Math.max(1, parseInt(env.TESS_TRIVIAL_MAX_CHARS || '80', 10) || 80);
  const effectiveMode = forceFull ? 'full' : mode;
  return { mode, forceFull, skipTrivial, trivialMaxChars, effectiveMode };
}

module.exports = {
  parseTessContextConfig,
};
