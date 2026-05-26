#!/usr/bin/env node
// Smoke test do stripBookingTags v2 — sem chamar TESS nem Trinks.
// Apenas valida que o parser reconhece v2 inline E v1 legacy.
//
// IMPORTANTE: usa o MESMO modulo que prod (backend/lib/booking-parser.js).
// Antes era logica duplicada — quando server.js evoluiu, o teste ficou desatualizado.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stripBookingTags, sanitizePrematureConfirm } = require('../backend/lib/booking-parser.js');

const CASES = [
  {
    name: 'v2 CREATE inline',
    input: 'Confirmo aqui então 👀\n\n[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-05-30T10:30:00-03:00 valor=85]',
    expects: { bookingConfirm: { service_id: 1, professional_id: 3, date_time: '2026-05-30T10:30:00-03:00', valor: 85 } }
  },
  {
    name: 'v2 CREATE inline com duracaoMinutos',
    input: 'Confirmando.\n\n[BOOKING_CREATE servicoId=2 profissionalId=5 dataHoraInicio=2026-06-01T15:00:00-03:00 valor=925 duracaoMinutos=300]',
    expects: { bookingConfirm: { service_id: 2, professional_id: 5, date_time: '2026-06-01T15:00:00-03:00', valor: 925, duration_minutes: 300 } }
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
    name: 'v2 HANDOFF_HUMAN sem args (default motivo)',
    input: 'Te transfiro.\n\n[HANDOFF_HUMAN]',
    expects: { handoffHuman: { motivo: 'cliente_pediu_humano' } }
  },
  {
    name: 'v1 legacy BOOKING_CONFIRM (retrocompat)',
    input: 'Ok!\n\n[BOOKING_CONFIRM]\n{"service_name":"Corte","professional_id":3,"date_time":"2026-05-30T10:30:00","duration_minutes":60}',
    expects: { bookingConfirm: { service_name: 'Corte', professional_id: 3 } }
  },
  {
    name: 'v1 legacy BOOKING_CANCEL (retrocompat)',
    input: 'Cancelando.\n\n[BOOKING_CANCEL]\n{"agendamento_id":12345,"motivo":"cliente_desistiu"}',
    expects: { bookingCancel: { agendamento_id: 12345, motivo: 'cliente_desistiu' } }
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
  },
  {
    name: 'Sanitizer fallback quando texto fica vazio',
    input: 'Agendado!',
    sanitize: true,
    expectedExact: 'Confirmo aqui então 👀'
  }
];

let pass = 0, fail = 0;
for (const c of CASES) {
  if (c.sanitize) {
    const out = sanitizePrematureConfirm(c.input);
    let ok;
    if (c.expectedExact) {
      ok = out === c.expectedExact;
    } else {
      ok = !c.sanitizedShouldNotMatch.test(out);
    }
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
