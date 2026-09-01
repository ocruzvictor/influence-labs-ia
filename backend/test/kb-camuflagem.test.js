const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const kbDir = path.join(__dirname, '../../data/kb/conversa-v2');

function read(name) {
  return fs.readFileSync(path.join(kbDir, name), 'utf8');
}

test('KB camuflagem — serviço documentado sem SKU de marca', () => {
  const regras = read('regras-comerciais.md');
  const sinonimos = read('sinonimos-servicos.md');
  const faq = read('faq-servicos.md');
  assert.match(regras, /Camuflagem de fios brancos/);
  assert.match(regras, /n[aã]o vendemos Gloss/i);
  assert.match(regras, /Capral/);
  assert.match(regras, /n[aã]o existe SKU Gloss/i);
  assert.match(sinonimos, /camuflagem/i);
  assert.match(sinonimos, /não combo/i);
  assert.match(faq, /camuflagem/i);
  assert.match(faq, /Gloss/);
});
