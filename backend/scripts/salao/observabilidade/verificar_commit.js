#!/usr/bin/env node
/**
 * OP006 — wrap de verifyCommit (I1). last4 only. Sem Trinks mutate.
 *
 * Uso: node verificar_commit.js --last4 0007 --minutos 30
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { verifyCommit } = require('../../../lib/nightwatch-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  if (!flags.last4) throw new Error('Passe --last4');
  const db = requireDb();
  printJson(await verifyCommit(db, {
    last4: flags.last4,
    minutes: flags.minutos,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
