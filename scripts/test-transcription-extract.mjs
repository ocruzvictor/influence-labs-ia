#!/usr/bin/env node
// Testes do extractKapsoTranscript — caminho primário do pipeline de áudio.
// Rodar: node scripts/test-transcription-extract.mjs
// Exit 0 = todos passam. Exit 1 = pelo menos um falhou.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { extractKapsoTranscript } = require('../backend/transcription.js');

const results = [];

function check(name, fn) {
  try {
    const ok = fn();
    results.push({ name, ok: !!ok });
    console.log(`${ok ? '✅' : '❌'} ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`❌ ${name} — ${e.message}`);
  }
}

// 1. Payload real do Kapso (capturado em prod hoje 26/05)
check('1. payload real Kapso prod (caminho feliz)', () => {
  const content = 'Audio attached (audio_ca0641ac85f0.ogg) [Size: 12.1 KB | Type: audio/opus] URL: https://app.kapso.ai/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsiZGF0YSI6ImYwZjYwNGIxLTI1N2MtNDJiMy04NzM1LTE1NTBkMmEyMzcxZSIsInB1ciI6ImJsb2JfaWQifX0=--6df30294a16f6dd3ab30ac3d349cf49d3db27b7a/audio_ca0641ac85f0.ogg \n\nTranscript: Oi, quero agendar um corte com o Tiago sábado 10 horas da manhã';
  const text = extractKapsoTranscript(content);
  return text === 'Oi, quero agendar um corte com o Tiago sábado 10 horas da manhã';
});

// 2. Sem Transcript: retorna null
check('2. sem Transcript retorna null', () => {
  const content = 'Audio attached (audio_XXX.ogg) [Size: 5 KB | Type: audio/opus] URL: https://example.com/audio.ogg';
  return extractKapsoTranscript(content) === null;
});

// 3. Transcript: vazio (so espaços) retorna null
check('3. Transcript: vazio retorna null', () => {
  const content = 'Audio attached. Transcript:   \n  ';
  return extractKapsoTranscript(content) === null;
});

// 4. Capitalização variada
check('4. "transcript:" minusculo funciona', () => {
  const content = 'Audio attached. transcript: texto aqui';
  return extractKapsoTranscript(content) === 'texto aqui';
});

check('5. "TRANSCRIPT:" maiusculo funciona', () => {
  const content = 'Audio attached. TRANSCRIPT: texto aqui';
  return extractKapsoTranscript(content) === 'texto aqui';
});

// 6. Espaços extras ao redor do ":"
check('6. "Transcript :" com espaco antes do : funciona', () => {
  const content = 'Audio attached. Transcript : texto aqui';
  return extractKapsoTranscript(content) === 'texto aqui';
});

// 7. Transcript multilinha (audio longo)
check('7. transcript multilinha preserva quebras', () => {
  const content = 'Audio attached. Transcript: Linha 1.\nLinha 2.\nLinha 3.';
  const expected = 'Linha 1.\nLinha 2.\nLinha 3.';
  return extractKapsoTranscript(content) === expected;
});

// 8. Input null/undefined/numero
check('8. null retorna null', () => extractKapsoTranscript(null) === null);
check('9. undefined retorna null', () => extractKapsoTranscript(undefined) === null);
check('10. numero retorna null (nao crash)', () => extractKapsoTranscript(42) === null);
check('11. string vazia retorna null', () => extractKapsoTranscript('') === null);

// 12. Caracteres especiais PT-BR (acentos, ç) preservados
check('12. acentos PT-BR preservados', () => {
  const content = 'Audio attached. Transcript: Não é possível, é uma questão de cancelamento três horas';
  return extractKapsoTranscript(content) === 'Não é possível, é uma questão de cancelamento três horas';
});

// 13. Multiplas ocorrencias de "Transcript:" pega a primeira via greedy [\s\S]+$
check('13. duas ocorrencias Transcript pega da primeira ate o fim', () => {
  const content = 'Audio attached. Transcript: parte1 Transcript: parte2';
  return extractKapsoTranscript(content) === 'parte1 Transcript: parte2';
});

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
if (failed.length > 0) {
  console.log('\nFALHAS:');
  failed.forEach(f => console.log(`  - ${f.name}${f.err ? `: ${f.err}` : ''}`));
  process.exit(1);
}
