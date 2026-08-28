#!/usr/bin/env node
// Smoke tests do prompt Conversa v2 — direto na API TESS (agente 46589).
// Uso: node scripts/test-conversa-v2.mjs

import fs from 'node:fs';
import { tessScriptHeaders } from './tess-auth.mjs';
// carrega backend/.env sem dependência externa
try {
  const envText = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.TESS_API_TOKEN;
const AGENT_ID = process.env.CONVERSA_AGENT_ID || '46589';
const BASE = (process.env.TESS_API_BASE || 'https://api.tess.im').replace(/\/+$/, '');
const URL = `${BASE}/agents/${AGENT_ID}/execute`;

if (!TOKEN) {
  console.error('TESS_API_TOKEN não encontrado. Rode: source backend/.env && node scripts/test-conversa-v2.mjs');
  process.exit(1);
}

const TODAY = new Date().toISOString().slice(0, 10);

// Contexto dinâmico mockado — simula o que o backend injeta em produção.
function dynamicContext({ slots = [], dadosCliente = null, historico = [] } = {}) {
  return `
CONTEXTO DINÂMICO (injetado pelo backend):
HOJE: ${TODAY}
SLOTS_DISPONIVEIS: ${JSON.stringify(slots)}
SERVICOS: [
  {id:1,nome:"Corte Masculino",preco:85,duracaoMin:60,profissionaisHabilitados:["Erick Barros","Andre de Oliveira","Tiago Rocha"]},
  {id:2,nome:"Tiago - Mechas",preco:925,duracaoMin:300,profissionaisHabilitados:["Tiago Rocha"]},
  {id:3,nome:"Mechas",preco:835,duracaoMin:330,profissionaisHabilitados:["Tiago Rocha","Eli","Fernanda","Giovanna"]}
]
PROFISSIONAIS: [
  {id:3,nome:"Erick Barros",especialidades:["corte masc","barba"]},
  {id:5,nome:"Tiago Rocha",especialidades:["premium"]}
]
DADOS_CLIENTE: ${JSON.stringify(dadosCliente)}
HISTORICO_CONVERSA: ${JSON.stringify(historico)}
`.trim();
}

const TESTS = [
  {
    name: '1. Agendamento (1º turno, ainda não confirmou)',
    context: dynamicContext({
      slots: [
        { profissional: 'Erick Barros', profissionalId: 3, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T10:30:00-03:00' }
      ],
      dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' },
      historico: []
    }),
    userMsg: 'queria cortar meu cabelo sábado com o Erick às 10h30',
    // 1º turno: bot precisa coletar tipo de corte OU pedir confirmação tripla. NÃO pode emitir booking ainda.
    expectsAny: ['confirmar', 'masculino', 'feminino', 'pra confirmar'],
    forbids: ['Agendado!', 'Confirmado!', '[BOOKING_CREATE']
  },
  {
    name: '1b. Agendamento (cliente confirmou — deve emitir tag)',
    context: dynamicContext({
      slots: [
        { profissional: 'Erick Barros', profissionalId: 3, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T10:30:00-03:00' }
      ],
      dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' },
      historico: [
        { role: 'user', content: 'queria cortar meu cabelo sábado com o Erick às 10h30' },
        { role: 'assistant', content: 'É corte masculino ou feminino?' },
        { role: 'user', content: 'masculino' },
        { role: 'assistant', content: 'Pra confirmar: Corte Masculino com o Erick, sábado dia 30/05 às 10h30, R$ 85. Tá certo?' }
      ]
    }),
    userMsg: 'isso, pode confirmar',
    expects: ['[BOOKING_CREATE'],
    forbids: ['Agendado!', 'Confirmado!', 'Pronto!']
  },
  {
    name: '2. Cancelamento',
    context: dynamicContext({
      dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000', ultimoAgendamento: { id: 498220145, servico: 'Corte e Barba', dataHora: '2026-05-26T15:00:00-03:00' } }
    }),
    userMsg: 'preciso cancelar meu horário de amanhã',
    expects: ['[BOOKING_CANCEL'],
    forbids: []
  },
  {
    name: '3. Mechas (fluxo consultivo)',
    context: dynamicContext({ dadosCliente: null }),
    userMsg: 'quanto custa mechas?',
    expects: ['teste'],
    forbids: ['R$ 835', 'R$ 925', '835', '925']
  },
  {
    name: '4. Reclamação → escalar humano',
    context: dynamicContext({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' } }),
    userMsg: 'isso tá uma bagunça, quero falar com alguém',
    expects: ['[HANDOFF_HUMAN', 'Gabriel'],
    forbids: ['promo', 'desconto', 'aproveitar']
  },
  {
    name: '5. Horário inexistente (não inventar)',
    context: dynamicContext({
      slots: [
        { profissional: 'Júlia', servico: 'Manicure', dataHoraInicio: '2026-05-26T10:00:00-03:00' },
        { profissional: 'Júlia', servico: 'Manicure', dataHoraInicio: '2026-05-26T16:00:00-03:00' }
      ]
    }),
    userMsg: 'tem com a Júlia dia 26 às 14h?',
    // Deve oferecer pelo menos UM dos slots reais E não confirmar 14h como disponível.
    expectsAny: ['10', '16'],
    notConfirms14h: true,  // check custom — ver função check()
    forbids: ['sim, às 14', 'às 14h tem', 'tem sim às 14']
  }
];

async function callTess(context, userMsg) {
  const body = {
    messages: [
      { role: 'user', content: `${context}\n\nMENSAGEM DO CLIENTE: ${userMsg}` }
    ],
    wait_execution: true
  };
  const res = await fetch(URL, {
    method: 'POST',
    headers: tessScriptHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TESS ${res.status}: ${text}`);
  }
  return res.json();
}

function extractOutput(json) {
  const r0 = json?.responses?.[0]?.output;
  if (r0 && r0.trim()) return r0;
  if (json?.output && String(json.output).trim()) return json.output;
  if (json?.response && String(json.response).trim()) return json.response;
  return `(SEM OUTPUT — raw: ${JSON.stringify(json).slice(0, 800)})`;
}

function check(out, t) {
  const lower = out.toLowerCase();
  const expects = t.expects || [];
  const expectsAny = t.expectsAny || [];
  const forbids = t.forbids || [];

  const missing = expects.filter(e => !lower.includes(e.toLowerCase()));
  const passedExp = missing.length === 0;
  const passedAny = expectsAny.length === 0 || expectsAny.some(e => lower.includes(e.toLowerCase()));
  const violated = forbids.filter(f => lower.includes(f.toLowerCase()));
  const passedFor = violated.length === 0;

  // check custom: not confirms 14h
  let passedNotConfirms = true;
  if (t.notConfirms14h) {
    // procura padrões afirmativos perto de "14"
    const affirmNear14 = /\b(sim|tem|claro|certo|pode)\b[^.!?]*?\b14h?\b/i.test(out) ||
                         /\b14h?\b[^.!?]*?\b(disponível|disponivel|livre|certo|confirma)/i.test(out);
    passedNotConfirms = !affirmNear14;
  }

  // check de formatação: bold/italic markdown
  const hasBold = /\*\*[^*]+\*\*/.test(out);
  const hasItalic = /(?<!\*)\*[^*\s][^*]*\*(?!\*)/.test(out);
  const hasUnderline = /__[^_]+__/.test(out);

  const ok = passedExp && passedAny && passedFor && passedNotConfirms;

  return {
    ok, missing, violated,
    passedAny, passedNotConfirms,
    formatting: { hasBold, hasItalic, hasUnderline }
  };
}

(async () => {
  console.log(`\n🤖 Testando TESS Conversa v2 — agente ${AGENT_ID}\n${'═'.repeat(70)}\n`);
  const results = [];
  for (const t of TESTS) {
    console.log(`\n▶ ${t.name}`);
    console.log(`  cliente: "${t.userMsg}"`);
    try {
      const json = await callTess(t.context, t.userMsg);
      const out = extractOutput(json);
      console.log(`  bot: ${out.slice(0, 400)}${out.length > 400 ? '…' : ''}`);
      const r = check(out, t);
      console.log(`  ${r.ok ? '✅ PASS' : '❌ FAIL'}`);
      if (r.missing.length) console.log(`     faltou: ${r.missing.join(', ')}`);
      if (!r.passedAny) console.log(`     nenhum dos esperados (any): ${(t.expectsAny||[]).join(', ')}`);
      if (!r.passedNotConfirms) console.log(`     bot confirmou horário inexistente`);
      if (r.violated.length) console.log(`     proibido encontrado: ${r.violated.join(', ')}`);
      const fmt = r.formatting;
      if (fmt.hasBold || fmt.hasItalic || fmt.hasUnderline) {
        console.log(`     ⚠️  formatação markdown: ${[fmt.hasBold && '**bold**', fmt.hasItalic && '*italic*', fmt.hasUnderline && '__underline__'].filter(Boolean).join(', ')}`);
      }
      results.push({ name: t.name, ok: r.ok, out, ...r });
    } catch (err) {
      console.log(`  ❌ ERRO: ${err.message}`);
      results.push({ name: t.name, ok: false, error: err.message });
    }
  }
  console.log(`\n${'═'.repeat(70)}`);
  const pass = results.filter(r => r.ok).length;
  console.log(`\nResultado: ${pass}/${results.length} passaram\n`);
  fs.writeFileSync('scripts/test-conversa-v2-results.json', JSON.stringify(results, null, 2));
  console.log('Detalhes em scripts/test-conversa-v2-results.json\n');
})();
