/**
 * Unit tests — POST /clientes payload (Story P0.3 TipoId).
 *   node --test backend/test/trinks-mapping.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCreateClientPayload,
  TELEFONE_TIPO_ID,
} = require('../lib/trinks-mapping');

test('createClient.1 — payload inclui Telefones[0].TipoId (whitelist 5511999998888, não 0101)', () => {
  const payload = buildCreateClientPayload({
    estabelecimentoId: '12345',
    nome: 'Cliente Teste',
    ddd: '11',
    numero: '999998888',
  });
  assert.equal(payload.telefones.length, 1);
  assert.equal(payload.telefones[0].ddd, '11');
  assert.equal(payload.telefones[0].numero, '999998888');
  assert.ok('TipoId' in payload.telefones[0], 'TipoId key must be present');
  assert.equal(payload.telefones[0].TipoId, TELEFONE_TIPO_ID.WHATSAPP);
  assert.equal(payload.telefones[0].TipoId, 6);
});

test('createClient.2 — TipoId inválido lança erro', () => {
  assert.throws(
    () => buildCreateClientPayload({ estabelecimentoId: '1', ddd: '11', numero: '999998888', tipoId: 99 }),
    /TipoId invalido/,
  );
});

test('createClient.3 — mock 2xx path: payload não omite TipoId (sem rede)', () => {
  const requests = [];
  const mockRequest = (path, opts) => {
    requests.push({ path, body: opts.body });
    if (!opts.body?.telefones?.[0]?.TipoId && opts.body?.telefones?.[0]?.TipoId !== 0) {
      throw new Error("Trinks 400: /clientes — Telefones[0].TipoId: 'Tipo Id' must not be empty.");
    }
    return { data: { id: 999001 } };
  };
  const payload = buildCreateClientPayload({
    estabelecimentoId: '999',
    nome: 'Nova Cliente',
    ddd: '11',
    numero: '987654321',
  });
  mockRequest('/clientes', { method: 'POST', body: payload });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.telefones[0].TipoId, TELEFONE_TIPO_ID.WHATSAPP);
});
