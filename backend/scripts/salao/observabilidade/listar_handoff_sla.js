#!/usr/bin/env node
/**
 * Handoff SLA — owner Tiago, 15 min comercial. last4 only.
 *
 * Uso: node listar_handoff_sla.js --minutos 720
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { listHandoffSla } = require('../../../lib/handoff-sla');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await listHandoffSla(db, { minutos: flags.minutos }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
