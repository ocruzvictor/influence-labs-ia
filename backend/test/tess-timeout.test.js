/**
 * Unit tests — TESS timeout fallback (Story 12).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { INTENTS } = require('../lib/tess-context-intent');
const {
  CANCEL_TIMEOUT_COPY,
  DEFAULT_TIMEOUT_COPY,
  isTessTimeoutError,
  buildTessTimeoutResponse,
  createTessTimeoutResult,
  createTessTimeoutEvent,
} = require('../lib/tess-timeout');

test('reconhece TimeoutError, AbortError e abort do fetch', () => {
  assert.equal(isTessTimeoutError({ name: 'TimeoutError' }), true);
  assert.equal(isTessTimeoutError({ name: 'AbortError' }), true);
  assert.equal(isTessTimeoutError(new Error('The operation was aborted due to timeout')), true);
  assert.equal(isTessTimeoutError({ code: 'UND_ERR_ABORTED' }), true);
  assert.equal(isTessTimeoutError({ cause: { name: 'TimeoutError' } }), true);
  assert.equal(isTessTimeoutError(new Error('TESS 500: agent failed')), false);
});

test('CANCEL timeout → copy honesta sem afirmar cancelamento', () => {
  const response = buildTessTimeoutResponse(INTENTS.CANCEL);
  assert.equal(response, CANCEL_TIMEOUT_COPY);
  assert.match(response, /não consegui cancelar/i);
  assert.match(response, /não foi alterado/i);
  assert.doesNotMatch(response, /cancelei|cancelado com sucesso|pronto/i);
});

test('timeout não-CANCEL → copy genérica honesta', () => {
  const response = buildTessTimeoutResponse(INTENTS.SCHEDULING);
  assert.equal(response, DEFAULT_TIMEOUT_COPY);
  assert.match(response, /não alterei seu agendamento/i);
  assert.doesNotMatch(response, /confirmado|agendado com sucesso/i);
});

test('resultado de timeout é diretamente enviável pelo webhook', () => {
  const result = createTessTimeoutResult(INTENTS.CANCEL);
  assert.deepEqual(result.responses, [result.response]);
  assert.equal(result.response, CANCEL_TIMEOUT_COPY);
  assert.equal('booking' in result, false);
  assert.equal('handoff' in result, false);
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('evento de timeout não contém conteúdo da mensagem do cliente', () => {
  const event = createTessTimeoutEvent({
    clientPhone: '0007',
    kapsoConversationId: 'kapso-test',
    intent: INTENTS.CANCEL,
    contextProfile: 'CANCEL',
    timeoutMs: 25_000,
  });
  assert.equal(event.event, 'tess.timeout');
  assert.deepEqual(event.payload, {
    intent: INTENTS.CANCEL,
    contextProfile: 'CANCEL',
    timeout_ms: 25_000,
  });
  assert.equal(JSON.stringify(event).includes('mensagem do cliente'), false);
});
