const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  consultarPrecoServico,
  consultarFaqEstatica,
  resolverIdCancelamento,
  NEVER_RESUME,
} = require('../lib/salao-cli-catalog');
const { simularSkipTrivial, agregarBytesContexto } = require('../lib/salao-cli-context');
const { relatarSloEventos } = require('../lib/salao-cli-ops');

test('consultarPrecoServico filters by keyword', () => {
  const result = consultarPrecoServico({
    termo: 'corte',
    services: [
      { nome: 'Corte masculino', preco: 80, id: 1 },
      { nome: 'Mecha', preco: 250, id: 2 },
    ],
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].nome, 'Corte masculino');
});

test('consultarFaqEstatica reads local markdown', () => {
  const faq = consultarFaqEstatica({ termo: 'endereco' });
  assert.equal(faq.status, 'ok');
  assert.match(faq.trecho, /Espirito Santo|Espírito Santo|Santo Antonio/i);
});

test('resolverIdCancelamento rejects SKU not owned', () => {
  const result = resolverIdCancelamento({
    id: '99',
    futureBookings: [{ trinks_id: '123', service_id: '8' }],
    knownServiceIds: ['99'],
  });
  assert.equal(result.agendamentoId, null);
  assert.ok(result.reason);
});

test('simularSkipTrivial: oi skips, compound never', () => {
  const oi = simularSkipTrivial({ texto: 'oi', skipEnabled: true });
  const compound = simularSkipTrivial({ texto: 'oi quero cortar', skipEnabled: true });
  const off = simularSkipTrivial({ texto: 'oi', skipEnabled: false });
  assert.equal(oi.skip, true);
  assert.equal(compound.skip, false);
  assert.equal(off.skip, false);
});

test('agregarBytesContexto groups p50/p95', () => {
  const lines = [
    JSON.stringify({
      event: 'tess.context_bytes',
      intent: 'CANCEL',
      context_profile: 'CANCEL',
      tess_context_mode: 'scoped',
      blocks: { total: { chars: 6000 } },
    }),
    JSON.stringify({
      event: 'tess.context_bytes',
      intent: 'CANCEL',
      context_profile: 'CANCEL',
      tess_context_mode: 'scoped',
      blocks: { total: { chars: 9000 } },
    }),
  ].join('\n');
  const agg = agregarBytesContexto(lines);
  assert.equal(agg.n, 2);
  assert.equal(agg.buckets[0].p50, 6000);
  assert.equal(agg.buckets[0].p95, 9000);
});

test('relatarSloEventos redacts phones', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('GROUP BY')) {
        return { rows: [{ event: 'tess.timeout', n: 2 }] };
      }
      return {
        rows: [{ event: 'tess.timeout', client_phone: '5511999990007', motivo: 'timeout' }],
      };
    },
  };
  const report = await relatarSloEventos(db, { minutos: 60 });
  assert.equal(report.counts['tess.timeout'], 2);
  assert.equal(report.sample[0].last4, '0007');
  assert.ok(!JSON.stringify(report).includes('5511999990007'));
});

test('NEVER_RESUME includes smoke last4s', () => {
  assert.deepEqual([...NEVER_RESUME], ['0007', '8440', '0101', '8194']);
});
