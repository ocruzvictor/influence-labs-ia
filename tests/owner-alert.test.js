#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  buildOwnerSummary,
  buildAlertPayload,
  maskPhone,
  shortId,
} = require('../n8n-workflows/lib/owner-alert');

function testMaskPhone() {
  assert.strictEqual(maskPhone('5511999887766'), '***7766');
}

function testShortId() {
  assert.strictEqual(shortId('wamid.HBgNNTUxMTk5OTg4Nzc2FQIAERgSQjA'), 'RgSQjA');
  assert.strictEqual(shortId('abc'), 'abc');
}

function testOwnerSummaryError() {
  const text = buildOwnerSummary({
    workflow: 'WF-01-router',
    status: 'error',
    error_code: 'intent_parse_failed',
    phone: '5511999887766',
    message: 'quero marcar horario',
    pediu: 'quero marcar horario',
    bot_action: 'nao conseguiu classificar a intencao',
    result_label: 'nao entendeu o que a pessoa queria',
    message_id: 'wamid.test123456',
  });

  assert.match(text, /📱 Atendimento #123456/);
  assert.match(text, /👤 Cliente: \*\*\*7766/);
  assert.match(text, /💬 Pediu: quero marcar horario/);
  assert.match(text, /❌ Resultado:/);
  assert.doesNotMatch(text, /intent_parse_failed/);
  assert.doesNotMatch(text, /\{"/);
}

function testAlertPayloadDualChannel() {
  const payload = buildAlertPayload({
    workflow: 'WF-META-01',
    event: 'message_handled',
    status: 'success',
    contact_name: 'Maria',
    pediu: 'tem horario sexta?',
    bot_action: 'mostrou horarios disponiveis',
    result_label: 'resposta enviada ao cliente',
    message_id: 'wamid.ok999',
  });

  assert.strictEqual(payload.channel, 'owner_alert');
  assert.strictEqual(payload.audience, 'owner');
  assert.match(payload.owner_summary, /Maria/);
  assert.match(payload.owner_summary, /✅/);
  assert.strictEqual(payload.technical.workflow, 'WF-META-01');
  assert.strictEqual(payload.technical.event, 'message_handled');
  assert.ok(payload.technical.timestamp);
}

function run() {
  testMaskPhone();
  testShortId();
  testOwnerSummaryError();
  testAlertPayloadDualChannel();
  console.log('owner-alert.test.js: 4 passed');
}

run();
