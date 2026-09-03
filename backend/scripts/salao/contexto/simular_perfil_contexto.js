#!/usr/bin/env node
/**
 * OP004 — mesmo texto em FULL vs SCOPED. 0 crédito TESS.
 *
 * Uso: node simular_perfil_contexto.js --texto "pode cancelar"
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { simularPerfilContexto } = require('../../../lib/salao-cli-context');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  const texto = flags.texto || flags.t;
  if (!texto || texto === true) {
    throw new Error('Passe --texto "mensagem do cliente"');
  }
  const db = flags.live ? requireDb() : null;
  const rows = await simularPerfilContexto({
    texto,
    db,
    phone: flags.phone && flags.phone !== true ? flags.phone : null,
  });
  printJson(rows);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
