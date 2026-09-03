#!/usr/bin/env node
/**
 * OP018 — simula shouldSkipTess. Default produção continua OFF; CLI mede.
 *
 * Uso: node simular_skip_trivial.js --texto "oi"
 *      node simular_skip_trivial.js --texto "oi quero cortar"
 */
const { loadBackendEnv, parseArgs, printJson } = require('../_lib/cli');
const { simularSkipTrivial } = require('../../../lib/salao-cli-context');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const texto = flags.texto || flags.t;
  if (!texto || texto === true) throw new Error('Passe --texto');
  const historico = flags['historico-vazio'] === false
    ? [{ role: 'user', content: 'antes' }]
    : [];
  printJson(simularSkipTrivial({
    texto,
    historico,
    skipEnabled: flags['skip-off'] ? false : true,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
