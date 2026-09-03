#!/usr/bin/env node
/**
 * OP013 — preço/SKU no snapshot via filterServicesByKeywords. 0 LLM.
 *
 * Uso: node consultar_preco_servico.js --termo "corte + barba" --live
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { consultarPrecoServico, consultarPrecoServicoLive } = require('../../../lib/salao-cli-catalog');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const termo = flags.termo || flags.t;
  if (!termo || termo === true) throw new Error('Passe --termo "corte"');
  if (flags.live) {
    const db = requireDb();
    printJson(await consultarPrecoServicoLive(db, { termo }));
    return;
  }
  let services = [];
  if (flags.fixture && flags.fixture !== true) {
    services = JSON.parse(flags.fixture);
  }
  printJson(consultarPrecoServico({ termo, services }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
