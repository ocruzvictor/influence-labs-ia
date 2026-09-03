/**
 * Testes — tess-premium-sanitize.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  hasPremiumLeak,
  premiumOnlyInTags,
  stripPremiumPhrases,
  sanitizePremiumResponse,
} = require('../lib/tess-premium-sanitize');

describe('hasPremiumLeak', () => {
  test('detecta tabela premium', () => {
    assert.ok(hasPremiumLeak('O André é da tabela premium.'));
  });

  test('ignora texto limpo', () => {
    assert.ok(!hasPremiumLeak('Corte com o Erick é R$85.'));
  });
});

describe('premiumOnlyInTags', () => {
  test('premium só na tag → não retry', () => {
    const text = 'Confirmo 👀\n[BOOKING_CREATE servicoId=1 premium=1]';
    assert.ok(premiumOnlyInTags(text));
  });

  test('premium no texto visível → retry', () => {
    assert.ok(!premiumOnlyInTags('Temos tabela premium com o André.'));
  });
});

describe('stripPremiumPhrases', () => {
  test('remove premium sem inventar preço', () => {
    const out = stripPremiumPhrases('Corte com André na tabela premium por R$100.');
    assert.ok(!/premium/i.test(out));
    assert.match(out, /R\$100/);
  });
});

describe('sanitizePremiumResponse', () => {
  test('texto limpo → sem retry', async () => {
    let retried = false;
    const r = await sanitizePremiumResponse({
      tessText: 'Horários com o Erick: 14h.',
      retryCall: async () => { retried = true; return 'x'; },
    });
    assert.equal(r.sanitized, false);
    assert.ok(!retried);
  });

  test('tabela premium → retry path mocked', async () => {
    let retried = false;
    const r = await sanitizePremiumResponse({
      tessText: 'O André é premium e tem horários.',
      sessionId: 'test-premium',
      retryCall: async () => {
        retried = true;
        return 'Com o André tenho 14h e 15h.';
      },
    });
    assert.ok(retried);
    assert.equal(r.sanitized, true);
    assert.equal(r.method, 'retry');
    assert.doesNotMatch(r.text, /premium/i);
  });

  test('retry ainda premium → strip mecânico', async () => {
    const r = await sanitizePremiumResponse({
      tessText: 'tabela premium com André',
      sessionId: 'test-strip',
      retryCall: async () => 'Ainda é premium exclusivo.',
    });
    assert.equal(r.sanitized, true);
    assert.equal(r.method, 'strip');
    assert.ok(!/premium|exclusivo/i.test(r.text));
  });

  test('preserva tags BOOKING', async () => {
    const tag = '[BOOKING_CREATE servicoId=1 profissionalId=2 dataHoraInicio=2026-09-02T14:00:00-03:00 valor=85 duracaoMinutos=60]';
    const r = await sanitizePremiumResponse({
      tessText: `Confirmo premium.\n${tag}`,
      retryCall: async () => `Ainda premium.\n${tag}`,
    });
    assert.ok(r.text.includes(tag));
  });
});
