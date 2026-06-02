/**
 * Testes unitários para backend/lib/booking-parser.js.
 *
 * Executa com Node test runner nativo (Node 18+, zero deps):
 *   node --test backend/test/booking-parser.test.js
 *   ou: cd backend && npm test
 *
 * Cobre a story bot-46589 (ajustes de resposta):
 *   - item 1: resolveServiceName (nome do serviço no card de confirmação)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveServiceName } = require('../lib/booking-parser');

const SERVICES = [
  { id: 12, nome: 'Corte Masculino' },
  { id: 34, nome: 'Avaliação para Mechas' },
  { id: 56, nome: 'Escova' },
];

test('item1.1 — resolve nome pelo ID (number)', () => {
  assert.equal(resolveServiceName(SERVICES, 34), 'Avaliação para Mechas');
});

test('item1.2 — resolve nome quando o ID vem como string (tag v2 parseada)', () => {
  assert.equal(resolveServiceName(SERVICES, '12'), 'Corte Masculino');
});

test('item1.3 — ID inexistente → null (caller degrada graciosamente, AC4)', () => {
  assert.equal(resolveServiceName(SERVICES, 999), null);
});

test('item1.4 — serviceId ausente/undefined → null', () => {
  assert.equal(resolveServiceName(SERVICES, undefined), null);
  assert.equal(resolveServiceName(SERVICES, null), null);
  assert.equal(resolveServiceName(SERVICES, 0), null);
});

test('item1.5 — data não-array (ex: Trinks falhou, data=[]/undefined) → null, nunca lança', () => {
  assert.equal(resolveServiceName([], 12), null);
  assert.equal(resolveServiceName(undefined, 12), null);
  assert.equal(resolveServiceName(null, 12), null);
});

test('item1.6 — item sem campo nome → null (não retorna undefined nem "id:")', () => {
  assert.equal(resolveServiceName([{ id: 7 }], 7), null);
});
