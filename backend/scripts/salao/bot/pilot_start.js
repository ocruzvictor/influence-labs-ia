#!/usr/bin/env node
/**
 * Liga PILOT_N. Não toca BOT_ACCEPT_ALL.
 *
 * Uso: node pilot_start.js --n 5
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { startPilot, DEFAULT_N } = require('../../../lib/bot-pilot');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  requireDb();
  const n = flags.n === true || flags.n == null ? DEFAULT_N : flags.n;
  printJson(await startPilot({ n, startedBy: 'cli' }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
