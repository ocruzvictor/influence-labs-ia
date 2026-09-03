#!/usr/bin/env node
/**
 * OP012 — idade do snapshot local. Não sincroniza. Não chama Trinks API.
 *
 * Uso: node checar_frescura_snapshot.js --max-idade-horas 24 --data 2026-09-04
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { checarFrescuraSnapshot } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await checarFrescuraSnapshot(db, {
    maxIdadeHoras: flags['max-idade-horas'],
    data: flags.data && flags.data !== true ? flags.data : null,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
