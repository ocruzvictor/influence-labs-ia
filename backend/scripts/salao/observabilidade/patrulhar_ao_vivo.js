#!/usr/bin/env node
/**
 * OP005 — wrap de patrolLive. Read-only. last4 na saída.
 *
 * Uso: node patrulhar_ao_vivo.js --minutos 15
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { patrolLive } = require('../../../lib/nightwatch-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await patrolLive(db, { minutes: flags.minutos }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
