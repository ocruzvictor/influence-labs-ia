const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classificarIntencao,
  medirOrcamentoContexto,
  simularPerfilContexto,
} = require('../lib/salao-cli-context');

test('classificarIntencao wraps CANCEL high', () => {
  const r = classificarIntencao({ texto: 'pode cancelar esse horário' });
  assert.equal(r.intent, 'CANCEL');
  assert.equal(r.confidence, 'high');
});

test('medirOrcamentoContexto fixture never calls Tess', async () => {
  const r = await medirOrcamentoContexto({
    texto: 'pode cancelar esse horário',
    mode: 'full',
  });
  assert.equal(r.intent, 'CANCEL');
  assert.equal(r.context_profile, 'CANCEL');
  assert.equal(r.blocks.horarios.chars, 0);
  assert.ok(r.blocks.total.chars >= 0);
});

test('simularPerfilContexto returns full and scoped rows', async () => {
  const rows = await simularPerfilContexto({ texto: 'quanto custa corte' });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.tess_context_mode), ['full', 'scoped']);
});
