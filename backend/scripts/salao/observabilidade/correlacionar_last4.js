#!/usr/bin/env node
/**
 * OP009 — last4 → thread + eventos + ledger. last4 only na saída.
 *
 * Uso: node correlacionar_last4.js --last4 0007 --minutos 30
 *      node correlacionar_last4.js --trace-id <uuid>
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { correlacionarLast4 } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const last4 = flags.last4 && flags.last4 !== true ? flags.last4 : null;
  const traceId = flags['trace-id'] && flags['trace-id'] !== true ? flags['trace-id'] : null;
  if (!traceId && !last4) {
    throw new Error('Passe --last4 0007 ou --trace-id <uuid>');
  }
  const db = requireDb();
  printJson(await correlacionarLast4(db, {
    last4,
    minutos: flags.minutos,
    traceId,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
