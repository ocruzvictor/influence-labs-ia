#!/usr/bin/env node
/**
 * Congela o PILOT. Cohort permanece allow. Demais silent.
 *
 * Uso: node pilot_stop.js
 */
const { loadBackendEnv, printJson, requireDb } = require('../_lib/cli');
const { stopPilot } = require('../../../lib/bot-pilot');

loadBackendEnv();

async function main() {
  requireDb();
  printJson(await stopPilot({ reason: 'cli' }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
