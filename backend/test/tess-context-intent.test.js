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

  test('history assistant asked horario → SCHEDULING high (not FULL dump)', () => {
    const history = [
      { role: 'user', content: 'quero cortar' },
      { role: 'assistant', content: 'Qual horário prefere?' },
    ];
    assert.ok(isSchedulingInProgress(history));
    const r = classifyTessIntent('10h', history, []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('funcionamento durante booking → FAQ (não SCHEDULING)', () => {
    const history = [
      { role: 'user', content: 'quero cortar amanhã' },
      { role: 'assistant', content: 'Qual horário prefere?' },
    ];
    const r = classifyTessIntent('qual horário de funcionamento?', history, []);
    assert.equal(r.intent, INTENTS.FAQ);
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.includes('faq'));
  });

  test('10h30 durante booking → SCHEDULING (não FAQ)', () => {
    const history = [
      { role: 'user', content: 'quero cortar amanhã' },
      { role: 'assistant', content: 'Qual horário prefere?' },
    ];
    const r = classifyTessIntent('10h30', history, []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
  });

  test('isso! after booking history → SCHEDULING high', () => {
    const history = [
      { role: 'user', content: 'quero o de 10h30' },
      { role: 'assistant', content: 'Confirma o horário de 10h30?' },
    ];
    const r = classifyTessIntent('isso!', history, []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('tem mais em conta? during booking → PRICING high', () => {
    const history = [
      { role: 'user', content: 'quanto custa pra cortar com o Tiago?' },
      { role: 'assistant', content: 'Corte com o Tiago é R$250. Quer que eu já veja os horários dele?' },
    ];
    const r = classifyTessIntent('tem profissional mais em conta?', history, []);
    assert.equal(r.intent, INTENTS.PRICING);
    assert.equal(r.confidence, 'high');
  });

  test('cancel with future bookings → CANCEL', () => {
    const r = classifyTessIntent('quero cancelar', [], [{ trinks_id: '1' }]);
    assert.equal(r.intent, INTENTS.CANCEL);
  });

  test('abort draft — cancelar sem booking + histórico agendamento → FAQ abort_draft', () => {
    const history = [
      { role: 'user', content: 'quero cortar amanhã' },
      { role: 'assistant', content: 'Prefere manhã ou tarde?' },
    ];
    const r = classifyTessIntent('vou precisar cancelar, deixa pra lá obrigado xau', history, []);
    assert.equal(r.intent, INTENTS.FAQ);
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.includes('abort_draft'));
  });

  test('abort dismiss — deixa pra lá durante draft → FAQ abort_draft', () => {
    const history = [
      { role: 'user', content: 'quero cortar amanhã' },
      { role: 'assistant', content: 'Com quem prefere?' },
    ];
    const r = classifyTessIntent('deixa pra lá obrigado xau', history, []);
    assert.equal(r.intent, INTENTS.FAQ);
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.includes('abort_draft'));
  });

  test('cancel sem booking fora de draft → CANCEL cancel_no_bookings', () => {
    const r = classifyTessIntent('quero cancelar meu horário', [], []);
    assert.equal(r.intent, INTENTS.CANCEL);
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.includes('cancel_no_bookings'));
  });

  test('long noisy multi-intent → UNCERTAIN', () => {
    const msg = 'oi preciso saber quanto custa a camuflagem e se tem horario amanha de tarde com a Gi por favor';
    const r = classifyTessIntent(msg, [], []);
    assert.equal(r.intent, INTENTS.UNCERTAIN);
  });

  test('cutover Oi vim pelo Studio Tirra quero agendar → SCHEDULING not FULL', () => {
    const r = classifyTessIntent('Oi, vim pelo Studio Tirra. Quero agendar', [], []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('sexta manhã escova jackie → SCHEDULING (bundle, not multi_intent FULL)', () => {
    const r = classifyTessIntent('sexta de manhã escova com a jackie', [], []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('quero cortar sábado 14h com o Erick → SCHEDULING', () => {
    const r = classifyTessIntent('quero cortar sábado 14h com o Erick', [], []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('Correto após histórico de agenda → SCHEDULING (não FULL)', () => {
    const history = [
      { role: 'user', content: 'corte infantil com o Erick sábado' },
      { role: 'assistant', content: '13h30 com o Erick, tá certo?' },
    ];
    const r = classifyTessIntent('Correto.', history, []);
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
  });

  test('0101-class: Outro dia pós-failed → SCHEDULING high (não FULL)', () => {
    const history = [
      { role: 'user', content: 'quero cortar sábado 14h30' },
      { role: 'assistant', content: 'Opa, tive um problema técnico ao confirmar esse horário 😕' },
    ];
    const r = classifyTessIntent('Outro dia', history, [], { lastBookingOutcome: 'failed' });
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.includes('post_failed'));
  });

  test('pós-failed: qual o endereço? → FAQ (não pin cego)', () => {
    const history = [
      { role: 'assistant', content: 'Opa, tive um problema técnico ao confirmar esse horário 😕' },
    ];
    const r = classifyTessIntent('qual o endereço?', history, [], { lastBookingOutcome: 'failed' });
    assert.equal(r.intent, INTENTS.FAQ);
    assert.equal(r.confidence, 'high');
  });

  test('pós-failed: quinta → SCHEDULING continuation', () => {
    const history = [
      { role: 'assistant', content: 'Esse horário não fecha na agenda da profissional' },
    ];
    const r = classifyTessIntent('quinta', history, [], { lastBookingOutcome: 'blocked' });
    assert.equal(r.intent, INTENTS.SCHEDULING);
    assert.equal(r.confidence, 'high');
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
