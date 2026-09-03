#!/usr/bin/env node
/**
 * OP017 — agrega tess.context_bytes (stdin/arquivo ou DB). Não cria evento.
 *
 * Uso: node agregar_bytes_contexto.js --arquivo logs.jsonl
 *      node agregar_bytes_contexto.js --live --minutos 1440
 */
const fs = require('fs');
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { agregarBytesContexto, agregarBytesContextoDb } = require('../../../lib/salao-cli-context');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  if (flags.live) {
    const db = requireDb();
    printJson(await agregarBytesContextoDb(db, { minutos: flags.minutos }));
    return;
  }
  let text = '';
  if (flags.arquivo && flags.arquivo !== true) {
    text = fs.readFileSync(flags.arquivo, 'utf8');
  } else {
    text = fs.readFileSync(0, 'utf8');
  }
  printJson(agregarBytesContexto(text));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
