#!/usr/bin/env node
/**
 * Aceite de handoff pelo Tiago. Emite handoff.accepted. Sem WhatsApp ao cliente.
 *
 * Uso: node aceitar_handoff.js --last4 6388
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { acceptHandoff } = require('../../../lib/handoff-sla');
const { emitOperationalEvent } = require('../../../lib/operational-events');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  if (!flags.last4) throw new Error('Passe --last4');
  const db = requireDb();
  printJson(await acceptHandoff(db, {
    last4: flags.last4,
    emitEvent: (evt) => emitOperationalEvent(db, evt),
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
