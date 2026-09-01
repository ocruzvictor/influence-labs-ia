/**
 * Testes — tess-context-intent (classificador + skip allowlist S1).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  INTENTS,
  classifyTessIntent,
  isTrivialAllowlist,
  shouldSkipTess,
  hasCompoundIntent,
  isSchedulingInProgress,
} = require('../lib/tess-context-intent');

describe('classifyTessIntent', () => {
  test('isolated oi → TRIVIAL high', () => {
    const r = classifyTessIntent('oi', [], []);
    assert.equal(r.intent, INTENTS.TRIVIAL);
    assert.equal(r.confidence, 'high');
  });

  test('oi quero cortar amanhã → SCHEDULING (never trivial)', () => {
    const r = classifyTessIntent('oi quero cortar amanhã', [], []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
    assert.ok(hasCompoundIntent('oi quero cortar amanhã'));
  });

  test('quanto custa amanhã → UNCERTAIN', () => {
    const r = classifyTessIntent('quanto custa amanhã?', [], []);
    assert.equal(r.intent, INTENTS.UNCERTAIN);
    assert.equal(r.confidence, 'low');
  });

  test('obrigado isolated first turn → TRIVIAL', () => {
    const r = classifyTessIntent('obrigado', [], []);
    assert.equal(r.intent, INTENTS.TRIVIAL);
  });

  test('endereço → FAQ', () => {
    const r = classifyTessIntent('qual o endereço?', [], []);
    assert.equal(r.intent, INTENTS.FAQ);
    assert.equal(r.confidence, 'high');
  });

  test('quanto custa o corte → PRICING', () => {
    const r = classifyTessIntent('quanto custa o corte?', [], []);
    assert.equal(r.intent, INTENTS.PRICING);
  });

  test('media marker → UNCERTAIN', () => {
    const r = classifyTessIntent('[CLIENTE ENVIOU IMAGEM]', [], []);
    assert.equal(r.intent, INTENTS.UNCERTAIN);
  });

  test('history assistant asked horario → UNCERTAIN (scheduling in progress)', () => {
    const history = [
      { role: 'user', content: 'quero cortar' },
      { role: 'assistant', content: 'Qual horário prefere?' },
    ];
    assert.ok(isSchedulingInProgress(history));
    const r = classifyTessIntent('10h', history, []);
    assert.equal(r.intent, INTENTS.UNCERTAIN);
  });

  test('cancel with future bookings → CANCEL', () => {
    const r = classifyTessIntent('quero cancelar', [], [{ trinks_id: '1' }]);
    assert.equal(r.intent, INTENTS.CANCEL);
  });

  test('long noisy multi-intent → UNCERTAIN', () => {
    const msg = 'oi preciso saber quanto custa a camuflagem e se tem horario amanha de tarde com a Gi por favor';
    const r = classifyTessIntent(msg, [], []);
    assert.equal(r.intent, INTENTS.UNCERTAIN);
  });
});

describe('shouldSkipTess', () => {
  test('default skip off → never skip', () => {
    assert.equal(shouldSkipTess({
      intent: INTENTS.TRIVIAL,
      confidence: 'high',
      history: [],
      messageText: 'oi',
      isMedia: false,
      skipEnabled: false,
    }), false);
  });

  test('skip on + isolated oi → skip', () => {
    assert.equal(shouldSkipTess({
      intent: INTENTS.TRIVIAL,
      confidence: 'high',
      history: [],
      messageText: 'oi',
      isMedia: false,
      skipEnabled: true,
    }), true);
  });

  test('oi quero cortar amanhã → never skip even with flag', () => {
    assert.equal(shouldSkipTess({
      intent: INTENTS.SCHEDULING,
      confidence: 'high',
      history: [],
      messageText: 'oi quero cortar amanhã',
      isMedia: false,
      skipEnabled: true,
    }), false);
  });

  test('media → never skip', () => {
    assert.equal(shouldSkipTess({
      intent: INTENTS.TRIVIAL,
      confidence: 'high',
      history: [],
      messageText: '[CLIENTE ENVIOU IMAGEM]',
      isMedia: true,
      skipEnabled: true,
    }), false);
  });

  test('message > max chars → never skip', () => {
    const long = 'oi '.repeat(50);
    assert.equal(shouldSkipTess({
      intent: INTENTS.TRIVIAL,
      confidence: 'high',
      history: [],
      messageText: long,
      isMedia: false,
      skipEnabled: true,
      trivialMaxChars: 80,
    }), false);
  });

  test('history non-empty → never skip', () => {
    assert.equal(shouldSkipTess({
      intent: INTENTS.TRIVIAL,
      confidence: 'high',
      history: [{ role: 'assistant', content: 'Oi!' }],
      messageText: 'oi',
      isMedia: false,
      skipEnabled: true,
    }), false);
  });
});

describe('isTrivialAllowlist', () => {
  test('allowlist matches', () => {
    assert.ok(isTrivialAllowlist('oi'));
    assert.ok(isTrivialAllowlist('Olá'));
    assert.ok(isTrivialAllowlist('obrigada'));
    assert.ok(isTrivialAllowlist('valeu'));
  });

  test('compound not allowlist', () => {
    assert.ok(!isTrivialAllowlist('oi quero cortar'));
  });
});
