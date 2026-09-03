/**
 * Story 5 — diff prompt I.8 / I.1.17 / I.12 / I.1.3 (Mira rule_suggestions 1–4).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const promptPath = path.join(__dirname, '../../docs/prompts/tess-conversa-v3-clean.md');
const prompt = fs.readFileSync(promptPath, 'utf8');

test('I.8 — não ensina script "Tá garantido"; usa frase neutra I.1.16', () => {
  const i8 = prompt.match(/## I\.8[\s\S]*?(?=## I\.9)/)?.[0] || '';
  assert.doesNotMatch(i8, /Tá garantido 😊/);
  assert.match(i8, /mesma.*resposta neutra de I\.1\.16/i);
  assert.match(i8, /Confirmo aqui o agendamento então/);
});

test('I.1.17 + NUNCA — ban afirmações prematuras além de Agendado/Confirmado/Pronto', () => {
  assert.match(prompt, /já confirmamos/);
  assert.match(prompt, /seu agendamento está/);
  assert.match(prompt, /tudo certo com \[serviço\]/);
  assert.match(prompt, /fica sim \[hora\]/);
});

test('I.12 — tag ≠ reserva; não "Emitida a tag, aquele serviço está criado"', () => {
  assert.doesNotMatch(prompt, /Emitida a tag, aquele serviço está criado/);
  assert.match(prompt, /Tag ≠ reserva/);
});

test('I.1.3 — 6 campos antes do CREATE; cadastro falho honesto', () => {
  assert.match(prompt, /todos os 6 campos antes.*\[BOOKING_CREATE\]/i);
  assert.match(prompt, /cadastro Trinks falhar.*dado_indisponivel/is);
});
