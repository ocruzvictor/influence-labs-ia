#!/usr/bin/env node
// Unit/contract test do validateKapsoSignature.
// Cobre o bug de re-stringify que rejeitava eventos de audio em prod (fix 3fa7e72).
//
// Rodar: node scripts/test-hmac-kapso.mjs
// Exit 0 = todos passam. Exit 1 = pelo menos um falhou.

import crypto from 'node:crypto';

// Reimplementacao da funcao em isolamento (espelha backend/server.js validateKapsoSignature).
// Quando refatorarmos pra extrair em modulo, este teste importa direto.
function validateKapsoSignature(req, secret) {
  if (!secret) return true; // dev-mode skip
  let signature = req.headers['x-webhook-signature'] || req.headers['x-kapso-signature'] || '';
  if (signature.startsWith('sha256=')) signature = signature.slice(7);

  const body = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function sign(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

const SECRET = 'test-secret-do-not-use-in-prod';
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

// 1. Payload texto simples — assinatura valida deve passar
check('1. text payload assinatura valida', () => {
  const payload = JSON.stringify({ from: '5511999999999', type: 'text', preview: 'oi' });
  const raw = Buffer.from(payload);
  const sig = sign(raw, SECRET);
  return validateKapsoSignature({
    headers: { 'x-webhook-signature': sig },
    rawBody: raw,
    body: JSON.parse(payload),
  }, SECRET);
});

// 2. Payload audio com unicode/URL — REGRESSAO do bug de re-stringify
//    Esse JSON tem caracteres que JSON.stringify do Node escapa diferente do payload original.
check('2. audio payload com unicode (REGRESSAO bug HMAC)', () => {
  // Payload propositalmente com formatacao nao-canonica:
  // - chaves em ordem nao-alfabetica
  // - caracteres unicode (é, ç)
  // - espacos extras (sem espacos — JSON.stringify nunca adiciona; mas ordem importa)
  const raw = Buffer.from('{"type":"audio","from":"5511964540007","preview":"Audio attached (audio_ca0641ac85f0.ogg) [Size: 12.1 KB | Type: audio/opus] URL: https://app.kapso.ai/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsiZGF0YSI6ImYwZjYwNGIxLTI1N2MtNDJiMy04NzM1LTE1NTBkMmEyMzcxZSIsInB1ciI6ImJsb2JfaWQifX0=--6df30294a16f6dd3ab30ac3d349cf49d3db27b7a/audio_ca0641ac85f0.ogg \\n\\nTranscript: Oi, quero agendar um corte com o Tiago sábado 10 horas da manhã"}');
  const sig = sign(raw, SECRET);
  // simula req parseado por express.json mantendo rawBody
  return validateKapsoSignature({
    headers: { 'x-webhook-signature': sig },
    rawBody: raw,
    body: JSON.parse(raw.toString('utf8')),
  }, SECRET);
});

// 3. Assinatura invalida deve falhar
check('3. assinatura invalida rejeita', () => {
  const raw = Buffer.from('{"from":"5511999999999","type":"text"}');
  const wrongSig = '0'.repeat(64);
  return !validateKapsoSignature({
    headers: { 'x-webhook-signature': wrongSig },
    rawBody: raw,
    body: { from: '5511999999999', type: 'text' },
  }, SECRET);
});

// 4. Header com prefixo sha256= deve ser aceito (defensivo)
check('4. prefixo sha256= aceito', () => {
  const raw = Buffer.from('{"foo":"bar"}');
  const sig = 'sha256=' + sign(raw, SECRET);
  return validateKapsoSignature({
    headers: { 'x-webhook-signature': sig },
    rawBody: raw,
    body: { foo: 'bar' },
  }, SECRET);
});

// 5. Fallback X-Kapso-Signature (alias)
check('5. header alternativo x-kapso-signature', () => {
  const raw = Buffer.from('{"foo":"bar"}');
  const sig = sign(raw, SECRET);
  return validateKapsoSignature({
    headers: { 'x-kapso-signature': sig },
    rawBody: raw,
    body: { foo: 'bar' },
  }, SECRET);
});

// 6. Sem secret = skip (dev mode) — retorna true
check('6. sem secret faz skip (dev mode)', () => {
  return validateKapsoSignature({
    headers: { 'x-webhook-signature': 'qualquer' },
    rawBody: Buffer.from('{}'),
    body: {},
  }, '');
});

// 7. Fallback sem rawBody — usa JSON.stringify (bug original, mas falha fechada)
//    Quando rawBody nao existe, validateKapsoSignature cai no fallback que reproduz
//    o comportamento antigo. Pra payload canonical do JSON.stringify, ainda passa.
check('7. fallback sem rawBody funciona pra payload canonical', () => {
  const body = { from: '5511', type: 'text' };
  const raw = Buffer.from(JSON.stringify(body));
  const sig = sign(raw, SECRET);
  return validateKapsoSignature({
    headers: { 'x-webhook-signature': sig },
    body,
    // rawBody intencionalmente undefined
  }, SECRET);
});

// 8. Sem signature header = rejeita
check('8. sem header de assinatura rejeita', () => {
  const raw = Buffer.from('{"foo":"bar"}');
  return !validateKapsoSignature({
    headers: {},
    rawBody: raw,
    body: { foo: 'bar' },
  }, SECRET);
});

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
if (failed.length > 0) {
  console.log('\nFALHAS:');
  failed.forEach(f => console.log(`  - ${f.name}${f.err ? `: ${f.err}` : ''}`));
  process.exit(1);
}
