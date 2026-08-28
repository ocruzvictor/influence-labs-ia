#!/usr/bin/env node
// Re-testa C1 (alucinação temporal) e C2 (tag inventada) após reforço de prompt.

import fs from 'node:fs';
import { tessScriptHeaders } from './tess-auth.mjs';
try {
  const envText = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.TESS_API_TOKEN;
const URL = `https://api.tess.im/agents/46589/execute`;
const TODAY = new Date().toISOString().slice(0, 10);

const SERVICOS = `[
  {id:1,nome:"Corte Masculino",preco:85,profissionaisHabilitados:["Erick Barros","Andre de Oliveira","Tiago Rocha"]},
  {id:12,nome:"Visagismo",preco:750,profissionaisHabilitados:["Tiago Rocha","Andre de Oliveira"]}
]`;

const TESTS = [
  {
    name: 'C1. SLOTS vazio — não inventar hora atual',
    context: `CONTEXTO DINÂMICO:
HOJE: ${TODAY}
HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO
SLOTS_DISPONIVEIS: []
SERVICOS: ${SERVICOS}
PROFISSIONAIS: [{id:2,nome:"Andre"},{id:3,nome:"Erick"},{id:5,nome:"Tiago"}]
DADOS_CLIENTE: {"id":100,"nome":"Carla","telefone":"11999990000"}
HISTORICO_CONVERSA: []`,
    userMsg: 'tem horário pra hoje?',
    warnings: [
      { test: o => /meia[- ]?noite|madrugada|quase fechando|tá tarde|ja é tarde|de manhã|à tarde|à noite/i.test(o), msg: 'inferiu hora do dia' },
      { test: o => /bom dia|boa tarde|boa noite/i.test(o), msg: 'saudação dependente de hora' },
      { test: o => /faltam? \d+ ?(h|horas?|minutos?)/i.test(o), msg: 'inferiu quanto falta pra fechar' },
      { test: o => /(às|as) \d{1,2}h/i.test(o) && !/funcionamos|ter[- ]sex|funcionament/i.test(o), msg: 'citou horário específico fora do horário de funcionamento' }
    ]
  },
  {
    name: 'C2. Profissional não habilitado — não inventar tag',
    context: `CONTEXTO DINÂMICO:
HOJE: ${TODAY}
HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h | Sab 9h-18h | Dom-Seg FECHADO
SLOTS_DISPONIVEIS: [{"profissional":"Tiago Rocha","profissionalId":5,"servico":"Visagismo","servicoId":12,"dataHoraInicio":"2026-05-30T14:00:00-03:00"}]
SERVICOS: ${SERVICOS}
PROFISSIONAIS: [{id:2,nome:"Andre"},{id:3,nome:"Erick"},{id:5,nome:"Tiago"}]
DADOS_CLIENTE: {"id":100,"nome":"Carla","telefone":"11999990000"}
HISTORICO_CONVERSA: []`,
    userMsg: 'quero visagismo com o Erick',
    warnings: [
      { test: o => /\[CHECK_AVAILABILITY|\[SEARCH|\[NOTIFY|\[BOOKING_INFO|\[ESCALATE\b/.test(o), msg: 'inventou tag fora da lista' },
      { test: o => /\[(?!BOOKING_CREATE|BOOKING_CANCEL|BOOKING_RESCHEDULE|HANDOFF_HUMAN)[A-Z_]+/.test(o), msg: 'qualquer outra tag não-permitida' },
      { test: o => /\[BOOKING_CREATE/.test(o) && /erick/i.test(o), msg: 'agendou Visagismo com profissional não habilitado' },
      { test: o => !/(tiago|andr[eé])/i.test(o), msg: 'não redirecionou pros habilitados' }
    ]
  }
];

async function call(ctx, msg) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: tessScriptHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messages: [{ role: 'user', content: `${ctx}\n\nMENSAGEM DO CLIENTE: ${msg}` }], wait_execution: true }),
    signal: AbortSignal.timeout(120_000)
  });
  if (!r.ok) throw new Error(`TESS ${r.status}: ${await r.text().catch(()=>'')}`);
  const j = await r.json();
  return j?.responses?.[0]?.output ?? '(SEM OUTPUT)';
}

(async () => {
  console.log(`\n🧪 Re-teste pós-fix — C1 e C2\n${'═'.repeat(70)}\n`);
  for (const t of TESTS) {
    console.log(`\n▶ ${t.name}`);
    console.log(`  cliente: "${t.userMsg}"`);
    try {
      const out = await call(t.context, t.userMsg);
      console.log(`  bot: ${out}`);
      const warns = t.warnings.filter(w => w.test(out)).map(w => w.msg);
      if (warns.length === 0) console.log(`  ✅ LIMPO`);
      else { console.log(`  ⚠️  warnings:`); warns.forEach(w => console.log(`     - ${w}`)); }
    } catch (err) {
      console.log(`  ❌ ERRO: ${err.message}`);
    }
  }
  console.log(`\n${'═'.repeat(70)}\n`);
})();
