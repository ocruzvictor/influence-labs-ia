#!/usr/bin/env node
/**
 * OP002 — monta contexto e mede chars/tokens por bloco. 0 crédito TESS.
 *
 * Uso:
 *   node medir_orcamento_contexto.js --texto "quero cortar amanhã" --mode full
 *   node medir_orcamento_contexto.js --texto "cancela" --mode scoped --live
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { medirOrcamentoContexto } = require('../../../lib/salao-cli-context');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const texto = flags.texto || flags.t;
  if (!texto || texto === true) {
    throw new Error('Passe --texto "mensagem do cliente"');
  }
  const mode = flags.mode === 'scoped' ? 'scoped' : 'full';
  const db = flags.live ? requireDb() : null;
  const result = await medirOrcamentoContexto({
    texto,
    mode,
    db,
    phone: flags.phone && flags.phone !== true ? flags.phone : null,
  });
  printJson(result);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
