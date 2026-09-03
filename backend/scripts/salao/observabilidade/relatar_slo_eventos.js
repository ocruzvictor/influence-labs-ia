#!/usr/bin/env node
/**
 * OP011 — taxas SLO a partir de bot_operational_events. last4 só na amostra.
 *
 * Uso: node relatar_slo_eventos.js --minutos 60
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { relatarSloEventos } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await relatarSloEventos(db, {
    minutos: flags.minutos,
    horas: flags.horas,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
