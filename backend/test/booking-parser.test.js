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
const { resolveServiceName, renderFutureBookings } = require('../lib/booking-parser');

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

// --- item 3 (Rota C): renderFutureBookings ---
const fmt = () => '03/06/2026 às 10:00'; // formatter stub

test('item3.1 — sem agendamentos → string vazia (sem seção)', () => {
  assert.equal(renderFutureBookings([], fmt), '');
  assert.equal(renderFutureBookings(null, fmt), '');
  assert.equal(renderFutureBookings(undefined, fmt), '');
});

test('item3.2 — 1 agendamento expõe bookingId real (trinks_id) + serviço + profissional', () => {
  const out = renderFutureBookings(
    [{ trinks_id: '486984217', service_name: 'Corte Masculino', professional_name: 'Erick', scheduled_at: 'x' }],
    fmt,
  );
  assert.match(out, /bookingId=486984217/);
  assert.match(out, /Corte Masculino com Erick em 03\/06\/2026 às 10:00/);
  assert.match(out, /AGENDAMENTOS FUTUROS DO CLIENTE/);
});

test('item3.3 — múltiplos → instrui a perguntar qual (desambiguação AC10)', () => {
  const out = renderFutureBookings(
    [
      { trinks_id: '1', service_name: 'Corte', professional_name: 'Erick', scheduled_at: 'a' },
      { trinks_id: '2', service_name: 'Barba', professional_name: 'Tiago', scheduled_at: 'b' },
    ],
    fmt,
  );
  assert.match(out, /bookingId=1/);
  assert.match(out, /bookingId=2/);
  assert.match(out, /PERGUNTE qual/);
});

test('item3.4 — sem professional_name não quebra; sem service_name usa fallback "serviço"', () => {
  const out = renderFutureBookings([{ trinks_id: '9', scheduled_at: 'a' }], fmt);
  assert.match(out, /bookingId=9 \| serviço em/);
  assert.ok(!/com undefined/.test(out), 'não imprime "com undefined"');
});

test('item3.5 — formatter ausente não lança (usa String como fallback)', () => {
  const out = renderFutureBookings([{ trinks_id: '9', service_name: 'X', scheduled_at: 'TS' }]);
  assert.match(out, /em TS/);
});
