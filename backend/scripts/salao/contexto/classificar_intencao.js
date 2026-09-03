#!/usr/bin/env node
/**
 * OP003 — classifica intenção no terminal. 0 LLM. Wrap de classifyTessIntent.
 *
 * Uso: node classificar_intencao.js --texto "pode cancelar esse horário"
 */
const { loadBackendEnv, parseArgs, printJson } = require('../_lib/cli');
const { classificarIntencao } = require('../../../lib/salao-cli-context');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const texto = flags.texto || flags.t;
  if (!texto || texto === true) {
    throw new Error('Passe --texto "mensagem do cliente"');
  }
  printJson(classificarIntencao({ texto }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
