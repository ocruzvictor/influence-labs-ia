const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFailedTessResponse } = require('../lib/tess-errors');

test('summarizeFailedTessResponse — payload failed sem dump do input', () => {
  const input = 'CONTEXTO DINAMICO - TRINKS\nHOJE: 01/09/2026\nMENSAGEM: Corte de cabelo feminino, com o Tiago.';
  const summary = summarizeFailedTessResponse({
    template_id: 46589,
    responses: [{
      id: 21300921,
      status: 'failed',
      input,
      error: 'agent execution failed',
    }],
  });
  assert.equal(summary.template_id, 46589);
  assert.equal(summary.response_id, 21300921);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.error, 'agent execution failed');
  assert.equal(summary.input_chars, input.length);
  const dumped = JSON.stringify(summary);
  assert.equal(dumped.includes('Corte de cabelo feminino'), false);
  assert.equal(dumped.includes('CONTEXTO DINAMICO'), false);
  assert.ok(summary.keys.includes('status'));
});

test('summarizeFailedTessResponse — error.message aninhado e input ausente', () => {
  const summary = summarizeFailedTessResponse({
    template_id: 46589,
    responses: [{ id: 1, status: 'failed', error: { message: 'timeout' } }],
  });
  assert.equal(summary.error, 'timeout');
  assert.equal(summary.input_chars, 0);
});

test('summarizeFailedTessResponse — raw vazio', () => {
  const summary = summarizeFailedTessResponse(null);
  assert.equal(summary.status, null);
  assert.equal(summary.input_chars, 0);
});
