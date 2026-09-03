#!/usr/bin/env node
/**
 * Re-alerta SLA estourado. Emite handoff.sla_breach. Não fala com o cliente.
 *
 * Uso: node realertar_handoff_sla.js
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { realertBreachedHandoffs } = require('../../../lib/handoff-sla');
const { emitOperationalEvent } = require('../../../lib/operational-events');

loadBackendEnv();

async function main() {
  parseArgs();
  const db = requireDb();
  printJson(await realertBreachedHandoffs(db, {
    emitEvent: (evt) => emitOperationalEvent(db, evt),
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
