#!/usr/bin/env node
/**
 * OP008 — stuck com filtro de silence/denylist. Não altera patrolLive.
 *
 * Uso: node listar_fios_presos.js --horas 12 --stuck-apos 3
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { listStuckThreadsFiltered } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  const result = await listStuckThreadsFiltered(db, {
    lookbackHours: flags.horas,
    stuckAfterMin: flags['stuck-apos'],
    filtrarSilence: flags['sem-filtro'] ? false : true,
  });
  printJson(result);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
