#!/usr/bin/env node
/**
 * OP010 — inbound user sem assistant depois de T segundos. Read-only. Não envia WhatsApp.
 *
 * Uso: node detectar_ack_sem_outbound.js --minutos 60 --segundos 45
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { listAckWithoutOutbound } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await listAckWithoutOutbound(db, {
    minutos: flags.minutos,
    segundos: flags.segundos,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
