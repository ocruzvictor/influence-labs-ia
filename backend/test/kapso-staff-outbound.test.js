const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  rememberBotSend,
  isStaffOutbound,
  extractOutboundText,
  resetBotSendMemoryForTests,
} = require('../lib/kapso-staff-outbound');

afterEach(() => {
  resetBotSendMemoryForTests();
});

test('eco cloud_api da Tess não é staff', () => {
  rememberBotSend('5511999000011', 'Oi! Posso ajudar?');
  assert.equal(isStaffOutbound({
    direction: 'outbound',
    origin: 'cloud_api',
    phone: '5511999000011',
    text: 'Oi! Posso ajudar?',
  }), false);
});

test('painel Kapso (cloud_api que a Tess não enviou) é staff', () => {
  assert.equal(isStaffOutbound({
    direction: 'outbound',
    origin: 'cloud_api',
    phone: '5511999000012',
    text: 'Oi amor, já te atendo',
  }), true);
});

test('business_app continua staff', () => {
  assert.equal(isStaffOutbound({
    direction: 'outbound',
    origin: 'business_app',
    phone: '5511999000013',
    text: 'Agendado seu pé e mão',
  }), true);
});

test('history_sync não é staff', () => {
  assert.equal(isStaffOutbound({
    direction: 'outbound',
    origin: 'history_sync',
    phone: '5511999000014',
    text: 'histórico',
  }), false);
});

test('inbound não é staff', () => {
  assert.equal(isStaffOutbound({
    direction: 'inbound',
    origin: 'cloud_api',
    phone: '5511999000015',
    text: 'quero cortar',
  }), false);
});

test('extractOutboundText lê text.body', () => {
  assert.equal(extractOutboundText({ type: 'text', text: { body: '  Olá  ' } }), 'Olá');
});
