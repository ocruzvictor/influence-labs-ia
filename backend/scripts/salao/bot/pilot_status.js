#!/usr/bin/env node
/**
 * Status do PILOT_N — last4 only.
 *
 * Uso: node pilot_status.js
 */
const { loadBackendEnv, printJson, requireDb } = require('../_lib/cli');
const { getPilotStatus } = require('../../../lib/bot-pilot');

loadBackendEnv();

async function main() {
  requireDb();
  printJson(await getPilotStatus());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
