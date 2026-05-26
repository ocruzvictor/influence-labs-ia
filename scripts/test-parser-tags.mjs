#!/usr/bin/env node
// Smoke test do stripBookingTags v2 — sem chamar TESS nem Trinks.
// Apenas valida que o parser reconhece v2 inline E v1 legacy.

import fs from 'node:fs';

// Import indireto: cola o codigo do server.js em modulo standalone seria mais limpo.
// Por simplicidade, replicamos a logica essencial aqui (mesma regex/funcao).
function normalizeJsonQuotes(s) { return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); }
function parseInlineArgs(argsStr) {
  const args = {};
  const re = /(\w+)=([^\s\]]+)/g;
  let m;
  while ((m = re.exec(argsStr)) !== null) args[m[1]] = m[2];
  return args;
}

function stripBookingTags(tessText) {
  let clean = tessText;
  let bookingConfirm = null, bookingCancel = null, bookingReschedule = null, handoffHuman = null;

  const createInline = clean.match(/\[BOOKING_CREATE\s+([^\]]+)\]/i);
  if (createInline) {
    const a = parseInlineArgs(createInline[1]);
    if (a.servicoId || a.dataHoraInicio || a.profissionalId) {
      bookingConfirm = {
        service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
        professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
        date_time: a.dataHoraInicio || undefined,
        valor: a.valor ? parseFloat(a.valor) : undefined,
      };
    }
    clean = clean.replace(createInline[0], '').trim();
  }
  const cancelInline = clean.match(/\[BOOKING_CANCEL\s+([^\]]+)\]/i);
  if (cancelInline) {
    const a = parseInlineArgs(cancelInline[1]);
    if (a.bookingId) bookingCancel = { agendamento_id: parseInt(a.bookingId, 10), motivo: a.motivo };
    clean = clean.replace(cancelInline[0], '').trim();
  }
  const reschedInline = clean.match(/\[BOOKING_RESCHEDULE\s+([^\]]+)\]/i);
  if (reschedInline) {
    const a = parseInlineArgs(reschedInline[1]);
    if (a.bookingId && a.novoDataHoraInicio) {
      bookingReschedule = { agendamento_id: parseInt(a.bookingId, 10), date_time: a.novoDataHoraInicio };
    }
    clean = clean.replace(reschedInline[0], '').trim();
  }
  const handoffInline = clean.match(/\[HANDOFF_HUMAN(?:\s+([^\]]+))?\]/i);
  if (handoffInline) {
    const a = handoffInline[1] ? parseInlineArgs(handoffInline[1]) : {};
    handoffHuman = { motivo: a.motivo || 'cliente_pediu_humano' };
    clean = clean.replace(handoffInline[0], '').trim();
  }
  if (!bookingConfirm) {
    const confMatch = clean.match(/\[BOOKING_CONFIRM\]\s*\n?({[\s\S]*?})/i);
    if (confMatch) {
      try { bookingConfirm = JSON.parse(normalizeJsonQuotes(confMatch[1])); } catch {}
      clean = clean.replace(confMatch[0], '').trim();
    }
  }
  return { clean, bookingConfirm, bookingCancel, bookingReschedule, handoffHuman };
}

const PREMATURE_CONFIRM_PATTERNS = [
  /\b(agendado|confirmado|pronto)\s*!+/gi,
  /\b(agendamento )?(realizado|finalizado|fechado)\b/gi,
  /\bte esperamos\b/gi,
];
function sanitizePrematureConfirm(text) {
  let s = text;
  for (const re of PREMATURE_CONFIRM_PATTERNS) s = s.replace(re, '');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s || 'Confirmo aqui então 👀';
}

const CASES = [
  {
    name: 'v2 CREATE inline',
    input: 'Confirmo aqui então 👀\n\n[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-05-30T10:30:00-03:00 valor=85]',
    expects: { bookingConfirm: { service_id: 1, professional_id: 3, date_time: '2026-05-30T10:30:00-03:00', valor: 85 } }
  },
  {
    name: 'v2 CANCEL inline',
    input: 'Sem problema! Cancelando.\n\n[BOOKING_CANCEL bookingId=498220145]',
    expects: { bookingCancel: { agendamento_id: 498220145 } }
  },
  {
    name: 'v2 RESCHEDULE inline',
    input: 'Vou reagendar.\n\n[BOOKING_RESCHEDULE bookingId=498220145 novoDataHoraInicio=2026-06-01T14:00:00-03:00]',
    expects: { bookingReschedule: { agendamento_id: 498220145, date_time: '2026-06-01T14:00:00-03:00' } }
  },
  {
    name: 'v2 HANDOFF_HUMAN inline',
    input: 'Vou pedir pro Gabriel.\n\n[HANDOFF_HUMAN motivo=reclamacao_atraso]',
    expects: { handoffHuman: { motivo: 'reclamacao_atraso' } }
  },
  {
    name: 'v1 legacy BOOKING_CONFIRM (retrocompat)',
    input: 'Ok!\n\n[BOOKING_CONFIRM]\n{"service_name":"Corte","professional_id":3,"date_time":"2026-05-30T10:30:00","duration_minutes":60}',
    expects: { bookingConfirm: { service_name: 'Corte', professional_id: 3 } }
  },
  {
    name: 'Texto puro sem tag',
    input: 'Oi! Em que posso ajudar? 😊',
    expects: { bookingConfirm: null, bookingCancel: null, bookingReschedule: null }
  },
  {
    name: 'Sanitizer remove "Agendado!"',
    input: 'Agendado! Te esperamos no sábado às 10h30.',
    sanitize: true,
    sanitizedShouldNotMatch: /Agendado!|Te esperamos/i
  }
];

let pass = 0, fail = 0;
for (const c of CASES) {
  if (c.sanitize) {
    const out = sanitizePrematureConfirm(c.input);
    const ok = !c.sanitizedShouldNotMatch.test(out);
    console.log(`${ok ? '✅' : '❌'} ${c.name}`);
    console.log(`   in:  "${c.input}"`);
    console.log(`   out: "${out}"`);
    ok ? pass++ : fail++;
    continue;
  }
  const r = stripBookingTags(c.input);
  let ok = true;
  for (const [key, expected] of Object.entries(c.expects)) {
    if (expected === null) {
      if (r[key] !== null) { ok = false; console.log(`   ❌ ${key} deveria ser null, veio ${JSON.stringify(r[key])}`); }
    } else {
      for (const [k, v] of Object.entries(expected)) {
        if (r[key]?.[k] !== v) { ok = false; console.log(`   ❌ ${key}.${k}: esperado ${JSON.stringify(v)}, veio ${JSON.stringify(r[key]?.[k])}`); }
      }
    }
  }
  console.log(`${ok ? '✅' : '❌'} ${c.name}  clean="${r.clean.slice(0,50)}${r.clean.length>50?'…':''}"`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass}/${pass+fail} passaram`);
process.exit(fail > 0 ? 1 : 0);
