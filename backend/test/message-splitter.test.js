/**
 * Testes unitários para backend/lib/message-splitter.js.
 *
 * Executa com Node test runner nativo (Node 18+, zero deps):
 *   node --test backend/test/message-splitter.test.js
 *   ou: cd backend && npm test
 *
 * Cobre os 8 cenários declarados na story A3
 * (docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md) + 6 extras.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitMessage } = require('../lib/message-splitter');

test('1. Texto sem <break> → array com 1 bolha', () => {
  const out = splitMessage('Oi! Tudo bem? 😊');
  assert.deepEqual(out, ['Oi! Tudo bem? 😊']);
});

test('2. Texto com 1 <break> → array com 2 bolhas', () => {
  const out = splitMessage('Oi João!\n<break>\nQuer agendar?');
  assert.equal(out.length, 2);
  assert.equal(out[0], 'Oi João!');
  assert.equal(out[1], 'Quer agendar?');
});

test('3. Texto com 3 <break> → array com 4 bolhas', () => {
  const out = splitMessage('A<break>B<break>C<break>D');
  assert.deepEqual(out, ['A', 'B', 'C', 'D']);
});

test('4. Texto humano + tag [BOOKING_CREATE ...] no final → tag íntegra na última bolha', () => {
  const input = `Confirmo aqui então 👀

[BOOKING_CREATE servicoId=12 profissionalId=3 dataHoraInicio=2026-05-31T10:30:00-03:00 valor=85 duracaoMinutos=60]`;
  const out = splitMessage(input);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('[BOOKING_CREATE servicoId=12'));
  assert.ok(out[0].includes('valor=85 duracaoMinutos=60]'));
  const tagMatch = out[0].match(/\[BOOKING_CREATE[^\]]+\]/);
  assert.ok(tagMatch, 'tag deve ser localizável por regex');
  assert.ok(tagMatch[0].includes('servicoId=12'));
  assert.ok(tagMatch[0].includes('valor=85'));
});

test('5. Texto com <break> no meio + tag → tag íntegra, <break> aplicado só no texto humano', () => {
  const input = `Show! Corte com Erick sábado.
<break>
Confirmo aqui então 👀
<break>
[BOOKING_CREATE servicoId=1 profissionalId=3 valor=70]`;
  const out = splitMessage(input);
  assert.equal(out.length, 3);
  assert.equal(out[0], 'Show! Corte com Erick sábado.');
  assert.equal(out[1], 'Confirmo aqui então 👀');
  assert.ok(out[2].startsWith('[BOOKING_CREATE'));
  assert.ok(out[2].endsWith(']'));
});

test('6. <break> defensivo dentro de tag → removido + tag preservada', () => {
  const originalWarn = console.warn;
  let warned = false;
  console.warn = (msg) => { if (typeof msg === 'string' && msg.includes('[message-splitter]')) warned = true; };
  try {
    const input = '[BOOKING_CREATE servicoId=1 <break> profissionalId=3 valor=85]';
    const out = splitMessage(input);
    assert.equal(out.length, 1);
    assert.ok(!out[0].includes('<break>'), '<break> deve ter sido removido');
    assert.ok(out[0].includes('[BOOKING_CREATE'));
    assert.ok(out[0].includes('servicoId=1'));
    assert.ok(out[0].includes('profissionalId=3'));
    assert.ok(out[0].includes('valor=85'));
    assert.ok(warned, 'console.warn deve ter sido chamado');
  } finally {
    console.warn = originalWarn;
  }
});

test('7. Tag multi-linha (com \\n interno) — íntegra', () => {
  const input = `Vou cancelar então.

[BOOKING_CANCEL bookingId=498220145
  motivo=cliente_pediu]`;
  const out = splitMessage(input);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('[BOOKING_CANCEL'));
  assert.ok(out[0].includes('bookingId=498220145'));
  assert.ok(out[0].includes('motivo=cliente_pediu'));
});

test('8. Strings vazias entre delimitadores não geram bolha vazia', () => {
  const input = 'A<break><break>B';
  const out = splitMessage(input);
  assert.deepEqual(out, ['A', 'B']);
});

// Extras: edge cases adicionais

test('extra: input null/undefined/vazio → array vazio', () => {
  assert.deepEqual(splitMessage(null), []);
  assert.deepEqual(splitMessage(undefined), []);
  assert.deepEqual(splitMessage(''), []);
  assert.deepEqual(splitMessage('   '), []);
});

test('extra: input não-string → array vazio (defensivo contra type errors)', () => {
  assert.deepEqual(splitMessage(123), []);
  assert.deepEqual(splitMessage({}), []);
});

test('extra: <break> case-insensitive (BREAK, Break, etc)', () => {
  const out = splitMessage('A<BREAK>B<Break>C');
  assert.deepEqual(out, ['A', 'B', 'C']);
});

test('extra: tag [HANDOFF_HUMAN] também é protegida', () => {
  const input = `Vou chamar o Gabriel.
<break>
[HANDOFF_HUMAN motivo=reclamacao_atendimento]`;
  const out = splitMessage(input);
  assert.equal(out.length, 2);
  assert.equal(out[0], 'Vou chamar o Gabriel.');
  assert.ok(out[1].startsWith('[HANDOFF_HUMAN'));
});

test('extra: 2 tags consecutivas — ambas íntegras na mesma bolha', () => {
  const input = `Pronto!
[BOOKING_CANCEL bookingId=1]
[BOOKING_CREATE servicoId=2 profissionalId=3]`;
  const out = splitMessage(input);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('[BOOKING_CANCEL bookingId=1]'));
  assert.ok(out[0].includes('[BOOKING_CREATE servicoId=2 profissionalId=3]'));
});

test('extra: emojis e acentos preservados nas bolhas', () => {
  const out = splitMessage('Oi João! 😊\n<break>\nVamos lá então ✌🏻');
  assert.equal(out[0], 'Oi João! 😊');
  assert.equal(out[1], 'Vamos lá então ✌🏻');
});

// Regressão H1 (QA gate 2026-05-26): input com NUL byte não confunde restauração de tags
test('H1 fix: input com \\x00 é sanitizado, não vira "undefined"', () => {
  // Input adversarial simulando padrão de placeholder interno do splitter.
  // Após strip de \x00, vira texto literal "ATAG0B" — não é tag real, não dispara
  // substituição. O importante é que JAMAIS apareça "undefined" no output.
  const out1 = splitMessage('A\x00TAG0\x00B');
  assert.deepEqual(out1, ['ATAG0B'], 'NUL strippado, resto vira texto literal');
  assert.ok(!out1[0].includes('undefined'), 'jamais inserir string literal "undefined"');

  // Input com NUL no meio de texto normal
  const out2 = splitMessage('Oi\x00mundo');
  assert.deepEqual(out2, ['Oimundo']);

  // Input só com NUL bytes
  const out3 = splitMessage('\x00\x00\x00');
  assert.deepEqual(out3, [], 'string só com NUL strippa para vazio → array vazio');

  // NUL + <break> + tag — tag ainda deve estar íntegra na bolha final
  const out4 = splitMessage('Show!\x00\n<break>\n[BOOKING_CREATE servicoId=1]');
  assert.equal(out4.length, 2);
  assert.equal(out4[0], 'Show!');
  assert.ok(out4[1].includes('[BOOKING_CREATE servicoId=1]'));
});
