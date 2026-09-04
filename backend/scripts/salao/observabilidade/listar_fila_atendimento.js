#!/usr/bin/env node
/**
 * Worklist derivada — last inbound/outbound + silêncio + último evento. last4 only.
 *
 * Uso: node listar_fila_atendimento.js --horas 12
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { listarFilaAtendimento } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const db = requireDb();
  printJson(await listarFilaAtendimento(db, {
    horas: flags.horas,
    sampleLimit: flags.limite,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
