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
const { resolveServiceName, renderFutureBookings, sanitizePrematureConfirm, renderHabilitacaoMap, formatIncompatibleProfServiceMessage, HABILITACAO_HEADER } = require('../lib/booking-parser');

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

// --- cancel sanitizer (AC11) ---
test('cancel.1 — sanitize remove "Cancelando seu agendamento..." quando há tag', () => {
  const out = sanitizePrematureConfirm('Cancelando seu agendamento agora, um instante!');
  assert.ok(!/cancelando/i.test(out), 'não deve manter linguagem de cancelamento em progresso');
});

test('cancel.2 — sanitize remove "Vou pedir o cancelamento pra você"', () => {
  const out = sanitizePrematureConfirm('Vou pedir o cancelamento pra você 👀');
  assert.ok(!/cancelamento/i.test(out));
});

// --- item 2: renderHabilitacaoMap ---
test('item2.1 — lista vazia / null → string vazia', () => {
  assert.equal(renderHabilitacaoMap([]), '');
  assert.equal(renderHabilitacaoMap(null), '');
  assert.equal(renderHabilitacaoMap(undefined), '');
});

test('item2.2 — serviços sem profissionais habilitados → string vazia', () => {
  assert.equal(renderHabilitacaoMap([{ id: 1, nome: 'X', profissionais: [] }]), '');
  assert.equal(renderHabilitacaoMap([{ id: 1, nome: 'X' }]), '');
});

test('item2.3 — um serviço com nomes presentes inclui header HABILITACAO e linha formatada', () => {
  const out = renderHabilitacaoMap([
    { id: 14129499, nome: 'Corte Masculino', profissionais: ['Erick', 'Tiago'] },
  ]);
  assert.match(out, new RegExp(HABILITACAO_HEADER.replace(/[()]/g, '\\$&')));
  assert.match(out, /Corte Masculino \(ID 14129499\): Erick, Tiago/);
  assert.match(out, /ignore HORARIOS VAGOS/);
});

test('item2.4 — múltiplos serviços listados; contexto dinâmico conteria HABILITACAO antes de slots', () => {
  const habilitacao = renderHabilitacaoMap([
    { id: 12, nome: 'Corte Masculino', profissionais: ['Erick', 'Tiago'] },
    { id: 34, nome: 'Escova', profissionais: ['Ana'] },
  ]);
  const slotsStub = 'HORARIOS VAGOS sabado:\n- Dylan: 10:00';
  const contextStub = ['DATAS COM DADOS DISPONIVEIS: sabado', '', habilitacao, slotsStub].join('\n');
  const habIdx = contextStub.indexOf('HABILITACAO');
  const slotsIdx = contextStub.indexOf('HORARIOS VAGOS');
  assert.ok(habIdx >= 0, 'contexto deve conter HABILITACAO');
  assert.ok(habIdx < slotsIdx, 'HABILITACAO deve vir antes de HORARIOS VAGOS');
  assert.match(contextStub, /Escova \(ID 34\): Ana/);
});

test('item2.5 — formatIncompatibleProfServiceMessage cita habilitados', () => {
  const msg = formatIncompatibleProfServiceMessage({
    professionalName: 'Dylan',
    serviceName: 'Corte Masculino',
    enabledProfessionals: ['Erick', 'Tiago'],
  });
  assert.match(msg, /Dylan não realiza Corte Masculino/);
  assert.match(msg, /Erick, Tiago/);
  assert.ok(!/problema técnico/i.test(msg));
});

test('item2.6 — recusa Dylan lista só os serviços reais do profissional (sem cabelo inventado)', () => {
  const msg = formatIncompatibleProfServiceMessage({
    professionalName: 'Dylan',
    serviceName: 'Corte Masculino',
    enabledProfessionals: ['Erick'],
    professionalServices: ['Manicure', 'Pedicure', 'Alongamento em gel'],
  });
  assert.match(msg, /Dylan atende: Manicure, Pedicure, Alongamento em gel/);
  assert.ok(!/capilar/i.test(msg));
  assert.ok(!/cabelo/i.test(msg));
});

test('catalog.1 — linha de serviço inclui preço e duração do snapshot', () => {
  const { formatServiceCatalogLine, formatBrl } = require('../lib/booking-parser');
  assert.equal(formatBrl(190), 'R$ 190');
  const line = formatServiceCatalogLine({
    id: 14129512,
    nome: 'Corte Feminino',
    preco: 190,
    duracaoEmMinutos: 120,
    profissionais: ['Giovanna', 'Jackie'],
  });
  assert.match(line, /Corte Feminino \[Giovanna, Jackie\] \(ID 14129512\) — R\$ 190 · 120min/);
});

test('catalog.1b — SKU laser recebe alias (laser) antes dos colchetes', () => {
  const { formatServiceCatalogLine } = require('../lib/booking-parser');
  const line = formatServiceCatalogLine({
    id: 15137040,
    nome: 'Depilação em 1 área',
    preco: 499,
    duracaoEmMinutos: 30,
    profissionais: ['Claudia'],
  });
  assert.match(line, /Depilação em 1 área \(laser\) \[Claudia\] \(ID 15137040\) — R\$ 499 · 30min/);
});

test('catalog.2 — servicesForProfessional filtra pelo apelido exato', () => {
  const { servicesForProfessional } = require('../lib/booking-parser');
  const list = [
    { nome: 'Manicure', profissionais: ['Dylan'] },
    { nome: 'Corte Masculino', profissionais: ['Erick'] },
    { nome: 'Pedicure', profissionais: ['Dylan'] },
  ];
  assert.deepEqual(servicesForProfessional(list, 'Dylan'), ['Manicure', 'Pedicure']);
});

test('dados-cliente.1 — cliente recorrente + phone → DADOS_CLIENTE (nunca PERFIL)', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  const out = buildPersistedSection({
    client: {
      name: 'Victor Cruz',
      last_service: 'Corte Masculino',
      last_visit: new Date('2026-08-17T19:24:14Z'),
      visit_count: 5,
    },
  }, '5511964540007');
  assert.match(out, /DADOS_CLIENTE:/);
  assert.match(out, /Nome: Victor Cruz/);
  assert.match(out, /Telefone: 5511964540007/);
  assert.match(out, /Ultimo servico: Corte Masculino/);
  assert.doesNotMatch(out, /PERFIL DO CLIENTE/);
});

test('dados-cliente.2 — só phone, sem clients → Telefone, sem Nome', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  const out = buildPersistedSection(null, '+55 11 96454-0007');
  assert.match(out, /DADOS_CLIENTE:/);
  assert.match(out, /Telefone: 5511964540007 \(WhatsApp — NAO peca de novo\)/);
  assert.doesNotMatch(out, /Nome:/);
});

test('dados-cliente.3 — sem memory e sem phone → vazio', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  assert.equal(buildPersistedSection(null, null), '');
  assert.equal(buildPersistedSection({}, ''), '');
});

test('sanitize.cliente — remove turno inventado Cliente:', () => {
  const { sanitizeInventedClientTurns } = require('../lib/booking-parser');
  const out = sanitizeInventedClientTurns('Posso marcar 14:30.\nCliente: 14:30\nFechado então.');
  assert.ok(!/Cliente:/i.test(out));
  assert.match(out, /Posso marcar 14:30/);
});

test('parser.combo — duas tags BOOKING_CREATE viram bookingCreates', () => {
  const { stripBookingTags } = require('../lib/booking-parser');
  const text = 'Confirmo aqui então 👀\n[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-08-18T14:00:00-03:00 valor=90 duracaoMinutos=60]\n[BOOKING_CREATE servicoId=2 profissionalId=3 dataHoraInicio=2026-08-18T15:00:00-03:00 valor=60 duracaoMinutos=30]';
  const parsed = stripBookingTags(text);
  assert.equal(parsed.bookingCreates.length, 2);
  assert.equal(parsed.bookingConfirm.service_id, 1);
  assert.equal(parsed.bookingCreates[1].service_id, 2);
  assert.ok(!/BOOKING_CREATE/.test(parsed.clean));
});
