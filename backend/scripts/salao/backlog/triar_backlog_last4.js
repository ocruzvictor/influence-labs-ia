#!/usr/bin/env node
/**
 * OP016 — reclassifica last4 do dossiê §2.2. Nunca retoma 0007/8440/0101/8194.
 *
 * Uso: node triar_backlog_last4.js
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { triarBacklogLast4 } = require('../../../lib/salao-cli-catalog');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  const last4s = flags.last4s && flags.last4s !== true
    ? String(flags.last4s).split(',').map((s) => s.trim())
    : undefined;
  printJson(await triarBacklogLast4(db, { last4s }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
