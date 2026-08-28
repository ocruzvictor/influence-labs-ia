const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_OWNER_PHONES,
  parseOwnerPhones,
  isOwnerPhone,
  renderOwnerContext,
} = require('../lib/owner-access');

test('AC1: fallback pin 5511937750330 quando env vazio', () => {
  const phones = parseOwnerPhones('');
  assert.deepEqual(phones, DEFAULT_OWNER_PHONES);
  assert.equal(isOwnerPhone('5511937750330', phones), true);
  assert.equal(isOwnerPhone('+55 11 93775-0330', phones), true);
});

test('AC1: env pinado prevalece sobre o fallback', () => {
  const phones = parseOwnerPhones('5511937750330');
  assert.deepEqual(phones, ['5511937750330']);
  assert.equal(isOwnerPhone('5511937750330', phones), true);
});

test('AC2: whitelist de teste / Victor não é dono', () => {
  const phones = parseOwnerPhones('5511937750330');
  assert.equal(isOwnerPhone('5511964540007', phones), false);
  assert.equal(isOwnerPhone('5511964542495', phones), false);
  assert.equal(isOwnerPhone('', phones), false);
  assert.equal(isOwnerPhone(null, phones), false);
});

test('AC3: renderOwnerContext só no dono e com regras de operador', () => {
  const phones = parseOwnerPhones('');
  const owner = renderOwnerContext('5511937750330', phones);
  assert.match(owner, /INTERLOCUTOR: TIAGO/);
  assert.match(owner, /dono/i);
  assert.match(owner, /5511937750330/);
  assert.match(owner, /HANDOFF_HUMAN/);
  assert.match(owner, /NÃO aplica sozinha/);
  assert.match(owner, /PODE pedir agendamento/);
  assert.doesNotMatch(owner, /TESTANDO como cliente/);

  assert.equal(renderOwnerContext('5511964540007', phones), '');
});

test('CSV de donos extras (sem dropar o pin se a lista env estiver preenchida)', () => {
  const phones = parseOwnerPhones('5511937750330, 55 11 99999-0000');
  assert.equal(isOwnerPhone('5511937750330', phones), true);
  assert.equal(isOwnerPhone('5511999990000', phones), true);
  assert.equal(isOwnerPhone('5511964540007', phones), false);
});
