#!/usr/bin/env node
/**
 * Story 6 AC3 — p95 de duration_ms por context_profile (tess.turn).
 *
 * Uso (VPS / container backend):
 *   node backend/scripts/salao/observabilidade/medir_p95_tess_turn.js --live
 *   node backend/scripts/salao/observabilidade/medir_p95_tess_turn.js --live --dia 2026-09-06
 *   node backend/scripts/salao/observabilidade/medir_p95_tess_turn.js --live --min-samples 3
 *
 * Predicado: payload.salon_day (America/Sao_Paulo), não received_at UTC.
 * Só turnos com duration_ms > 0, skipped_tess=false.
 */
const { loadBackendEnv, parseArgs, requireDb, printJson } = require('../_lib/cli');
const { medirP95TessTurn } = require('../../../lib/salao-cli-p95');
const { salonDayKey } = require('../../../lib/trinks-usage');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  if (!flags.live) {
    console.error('Use --live (roda no container backend com DATABASE_URL).');
    console.error('Opcional: --dia YYYY-MM-DD · --min-samples N (default 5).');
    process.exit(1);
  }
  const db = requireDb();
  const salonDay = flags.dia && flags.dia !== true ? String(flags.dia) : salonDayKey();
  const minSamples = flags['min-samples'] != null && flags['min-samples'] !== true
    ? Number.parseInt(String(flags['min-samples']), 10)
    : 5;
  printJson(await medirP95TessTurn(db, {
    salonDay,
    minSamples: Number.isFinite(minSamples) ? minSamples : 5,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
