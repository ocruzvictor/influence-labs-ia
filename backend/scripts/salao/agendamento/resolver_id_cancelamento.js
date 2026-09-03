#!/usr/bin/env node
/**
 * OP015 — wrap resolveCancelAgendamentoId. Sem PATCH.
 *
 * Uso: node resolver_id_cancelamento.js --id 123 --futuros '[{"trinks_id":"123"}]'
 */
const { loadBackendEnv, parseArgs, printJson } = require('../_lib/cli');
const { resolverIdCancelamento } = require('../../../lib/salao-cli-catalog');

loadBackendEnv();

async function main() {
  const { flags } = parseArgs();
  if (!flags.id) throw new Error('Passe --id');
  const futureBookings = flags.futuros && flags.futuros !== true
    ? JSON.parse(flags.futuros)
    : [];
  const knownServiceIds = flags.skus && flags.skus !== true
    ? String(flags.skus).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  printJson(resolverIdCancelamento({
    id: flags.id,
    futureBookings,
    knownServiceIds,
  }));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
