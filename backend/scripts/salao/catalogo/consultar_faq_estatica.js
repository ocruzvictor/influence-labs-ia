#!/usr/bin/env node
/**
 * OP014 — FAQ local (info-estatica.md). Sem PATCH Tess.
 *
 * Uso: node consultar_faq_estatica.js --termo endereco
 */
const { loadBackendEnv, parseArgs, printJson } = require('../_lib/cli');
const { consultarFaqEstatica } = require('../../../lib/salao-cli-catalog');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const termo = flags.termo || flags.t;
  if (!termo || termo === true) throw new Error('Passe --termo endereco|pix|funcionamento|estacionamento');
  printJson(consultarFaqEstatica({ termo }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
