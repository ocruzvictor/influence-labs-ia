#!/usr/bin/env node
/**
 * OP007 — wrap de listOrphans. Read-only.
 *
 * Uso: node listar_orfaos.js --minutos 15
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { listOrphans } = require('../../../lib/nightwatch-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await listOrphans(db, { minutes: flags.minutos }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
