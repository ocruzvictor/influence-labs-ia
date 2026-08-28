#!/usr/bin/env node
// Bateria v3 — valida R1-R4 + NR2-NR4 do prompt tess-conversa-v3.md.
// Para NR1 (não-regressão geral), rode separadamente: node scripts/test-conversa-v2-robust.mjs
//
// REQUISITO: o prompt v3.0.1 precisa estar colado no agente TESS 46589
// ANTES de rodar este script. Caso contrário, vai medir a v2.

import fs from 'node:fs';
import { tessScriptHeaders } from './tess-auth.mjs';
try {
  const envText = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
  let loaded = 0;
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      loaded++;
    }
  }
  if (process.env.DEBUG_ENV) console.error(`[env] loaded ${loaded} vars from backend/.env`);
} catch (e) {
  console.error(`[env] failed to load backend/.env: ${e.message}`);
}

const TOKEN = process.env.TESS_API_TOKEN;
const AGENT_ID = '46589';
const TESS_URL = `https://api.tess.im/agents/${AGENT_ID}/execute`;
const TODAY = new Date().toISOString().slice(0, 10);

const FULL_SLOTS = [
  { profissional: 'Erick Barros', profissionalId: 3, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T10:30:00-03:00' },
  { profissional: 'Erick Barros', profissionalId: 3, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T14:00:00-03:00' },
  { profissional: 'Andre de Oliveira', profissionalId: 2, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T11:00:00-03:00' },
  { profissional: 'Tiago Rocha', profissionalId: 5, servico: 'Corte Masculino', servicoId: 1, dataHoraInicio: '2026-05-30T09:00:00-03:00' },
];

// SERVICOS com preços DIFERENCIADOS por profissional pra estressar R1/R2/R3.
// (Schema do v2: SERVICOS é por serviço, não por profissional. Pra teste de
// comparativo, injeto via mensagem do cliente OU via PROFISSIONAIS com hint.)
const FULL_SERVICOS = [
  { id: 1, nome: 'Corte Masculino', preco: 100, duracaoMin: 60, profissionaisHabilitados: ['Erick Barros', 'Andre de Oliveira', 'Tiago Rocha'], precos_por_profissional: { 'Tiago Rocha': 100, 'Andre de Oliveira': 100, 'Erick Barros': 70 } },
  { id: 7, nome: 'Cabelo e Barba', preco: 130, duracaoMin: 60, profissionaisHabilitados: ['Erick Barros', 'Andre de Oliveira', 'Tiago Rocha'] },
  { id: 12, nome: 'Visagismo', preco: 750, duracaoMin: 90, profissionaisHabilitados: ['Tiago Rocha', 'Andre de Oliveira'] },
];

const FULL_PROFISSIONAIS = [
  { id: 2, nome: 'Andre de Oliveira', especialidades: ['Corte Masculino', 'Visagismo'] },
  { id: 3, nome: 'Erick Barros', especialidades: ['Corte Masculino', 'Corte Clássico'] },
  { id: 5, nome: 'Tiago Rocha', especialidades: ['Corte Masculino', 'Visagismo', 'Premium'] },
];

function ctx({ slots = FULL_SLOTS, dadosCliente = null, historico = [] } = {}) {
  return `CONTEXTO DINÂMICO (injetado pelo backend):
HOJE: ${TODAY}
SLOTS_DISPONIVEIS: ${JSON.stringify(slots)}
SERVICOS: ${JSON.stringify(FULL_SERVICOS)}
PROFISSIONAIS: ${JSON.stringify(FULL_PROFISSIONAIS)}
DADOS_CLIENTE: ${JSON.stringify(dadosCliente)}
HISTORICO_CONVERSA: ${JSON.stringify(historico)}
HORARIO_AGORA: 14:30 (DENTRO do horario — salao ABERTO)`;
}

// Helpers de checagem.
const hasTag = out => /\[(BOOKING_CREATE|BOOKING_CANCEL|BOOKING_RESCHEDULE|HANDOFF_HUMAN)/.test(out);
const breakInsideTag = out => {
  // Procura <break> dentro de [...] (incluindo multi-linha)
  const tagBlocks = out.match(/\[(BOOKING_[A-Z]+|HANDOFF_HUMAN)[^\]]*\]/gs) || [];
  return tagBlocks.some(b => /<break>/i.test(b));
};
const countBreaks = out => (out.match(/<break>/gi) || []).length;
const mentionsCompetitor = out => {
  // Procura 2+ nomes de profissionais OU 2+ preços diferentes no output
  const profMatches = out.match(/(tiago|erick|andr[eé])/gi) || [];
  const uniqueProfs = new Set(profMatches.map(s => s.toLowerCase()));
  const priceMatches = out.match(/r\$\s*\d+|\b\d{2,3}\s*reais/gi) || [];
  return { profs: [...uniqueProfs], prices: priceMatches };
};

const TESTS = [
  // ─────── R1 — Preço de UM profissional, SEM alternativa não-solicitada ───────
  {
    group: 'R1. Preço único sem comparativo',
    name: 'R1.1 — "quanto custa pra cortar com o Tiago?"',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'quanto custa pra cortar com o Tiago?',
    expects: out => {
      const compare = mentionsCompetitor(out);
      const checks = [];
      // Deve mencionar valor (R$100 ou 100 reais ou similar)
      if (!/100|cem/i.test(out)) checks.push('não mencionou valor R$100 do Tiago');
      // Não deve listar Erick ou André sem provocação
      if (compare.profs.length > 1) checks.push(`citou outros profissionais sem solicitação: ${compare.profs.join(', ')}`);
      // Não deve listar múltiplos preços
      if (compare.prices.length > 1) checks.push(`listou múltiplos preços: ${compare.prices.join(', ')}`);
      return checks;
    }
  },

  // ─────── R1 sequência — alternativa SOLICITADA permite mencionar ───────
  {
    group: 'R1. Alternativa permitida quando solicitada',
    name: 'R1.2 — após R1, cliente pede "tem mais em conta?"',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' }, historico: [
      { role: 'user', content: 'quanto custa pra cortar com o Tiago?' },
      { role: 'assistant', content: 'Corte com o Tiago é R$100. 😊\n<break>\nQuer que eu já veja os horários dele?' }
    ]}),
    userMsg: 'tem profissional mais em conta?',
    expects: out => {
      const checks = [];
      // Agora SIM pode mencionar Eric
      if (!/erick|eric/i.test(out)) checks.push('não citou alternativa Erick mesmo após cliente solicitar');
      // R3 — diferenciação por qualidade, NÃO por "mais barato/em conta/desconto"
      if (/(mais barato|mais em conta|economi|desconto|sai por menos|menor preço)/i.test(out)) checks.push('R3 violado: diferenciou por preço, não por qualidade');
      // Se citar Erick, deve citar com qualidade (ótimo/especialidade/clássico/prático)
      if (/erick/i.test(out) && !/(ótimo|otimo|especialidade|clássic|classic|prátic|pratic|excelente|bom em|trabalha bem)/i.test(out)) checks.push('R3 risco: citou Erick mas sem qualificar por qualidade');
      return checks;
    }
  },

  // ─────── R2 — Pergunta genérica sobre preço, sem profissional ───────
  {
    group: 'R2. Sem comparativo não-solicitado',
    name: 'R2.1 — "quanto custa um corte?" (sem profissional)',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'quanto custa um corte?',
    expects: out => {
      const checks = [];
      // Critério REAL do briefing R2: comparativo = mapeamento profissional→preço (não apenas
      // "menciona profs e preços"). Intervalo agregado (R$X a R$Y) NÃO é comparativo.
      // Regex: detecta "Nome … R$valor" ou "R$valor … Nome" em janela curta.
      const profNames = ['tiago', 'erick', 'eric', 'andr[eé]'];
      const profRegex = new RegExp(`(${profNames.join('|')})[^\\n.]{0,30}r\\$\\s*\\d+|r\\$\\s*\\d+[^\\n.]{0,30}(${profNames.join('|')})`, 'gi');
      const mappings = [...out.matchAll(profRegex)];
      if (mappings.length >= 2) {
        checks.push(`R2 violado: ${mappings.length} mapeamentos profissional→preço detectados (comparativo individual)`);
      }
      // Comportamento OK: pergunta com qual profissional OU dá faixa/intervalo
      const okBehavior = /(com qual profissional|qual prefere|qual deles|preferência|faixa|varia|começa|a partir|\bR\$\s*\d+\s*a\s*R\$|\bentre\s+R\$)/i.test(out);
      const hasAnyPrice = /R\$\s*\d+/i.test(out);
      if (!okBehavior && !hasAnyPrice) checks.push('não perguntou profissional nem deu faixa de preço');
      return checks;
    }
  },

  // ─────── R3 — Quando solicitada diferenciação, usa qualidade ───────
  {
    group: 'R3. Diferenciação por qualidade',
    name: 'R3.1 — "qual a diferença entre o Tiago e o Erick?"',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'qual a diferença entre cortar com o Tiago e com o Erick?',
    expects: out => {
      const checks = [];
      // Deve mencionar qualidade/especialidade
      const hasQuality = /(especialidade|ótimo|otimo|clássic|classic|estilo|trabalho|experiente|prátic|pratic|premium|visagism|bom em|excelente|forte em)/i.test(out);
      if (!hasQuality) checks.push('R3 violado: não diferenciou por qualidade/especialidade');
      // Não deve apelar pra preço como diferencial
      const usesPrice = /(mais caro|mais barato|valor maior|valor menor|premium.*preço|preço.*premium)/i.test(out);
      if (usesPrice) checks.push('R3 violado: usou diferencial de preço pra comparar');
      return checks;
    }
  },

  // ─────── R4 — Quebra de mensagem em conversa ───────
  {
    group: 'R4. Quebra de mensagens com <break>',
    name: 'R4.1 — "queria cortar sábado" (resposta com 2+ ideias)',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'queria cortar meu cabelo sábado',
    expects: out => {
      const checks = [];
      const n = countBreaks(out);
      // Espera ao menos 1 <break> (= 2 bolhas)
      if (n < 1) checks.push(`R4 violado: zero <break> em resposta conversacional (esperado >=1)`);
      // Sanidade: não pode ter <break> dentro de tag
      if (breakInsideTag(out)) checks.push('NR2 violado: <break> apareceu dentro de tag');
      return checks;
    }
  },

  // ─────── R4 — Bloco único na confirmação ───────
  {
    group: 'R4. Confirmação tripla em bloco único',
    name: 'R4.2 — confirmação após escolha (deve ser bloco único)',
    context: ctx({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' }, historico: [
      { role: 'user', content: 'queria cortar sábado às 10h30 com o Erick' },
      { role: 'assistant', content: 'Com o Erick no sábado tenho 9h, 10h30 e 11h. Qual prefere?' }
    ]}),
    userMsg: '10h30',
    expects: out => {
      const checks = [];
      const n = countBreaks(out);
      // Confirmação tripla deve ser bloco único
      // (mas o output pode ter texto humano + tag na mesma resposta — só o texto humano de confirmação que precisa ser bloco)
      // Sinais de confirmação tripla: serviço + profissional + dia/hora + valor + pergunta de confirmação
      const isConfirmation = /(pra confirmar|confirma|tá certo|certo\?|posso confirmar)/i.test(out) && /erick/i.test(out) && /10h30|10:30/i.test(out);
      if (isConfirmation && n > 0) checks.push(`R4 violado: confirmação estruturada tem ${n} <break> (esperado 0 — bloco único)`);
      return checks;
    }
  },

  // ─────── NR2 — Tags íntegras (não quebradas por <break>) ───────
  {
    group: 'NR2. Tags íntegras',
    name: 'NR2.1 — finalização de booking não quebra tag',
    context: ctx({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' }, historico: [
      { role: 'user', content: 'queria cortar sábado às 10h30 com o Erick' },
      { role: 'assistant', content: 'Com o Erick no sábado tenho 9h, 10h30 e 11h. Qual prefere?' },
      { role: 'user', content: '10h30' },
      { role: 'assistant', content: 'Pra confirmar: Corte Masculino com o Erick, sábado dia 30/05 às 10h30, R$ 70. Tá certo?' }
    ]}),
    userMsg: 'isso!',
    expects: out => {
      const checks = [];
      if (!hasTag(out)) checks.push('não emitiu tag [BOOKING_CREATE] após confirmação do cliente');
      if (breakInsideTag(out)) checks.push('NR2 violado: <break> apareceu dentro de tag [BOOKING_*]');
      return checks;
    }
  },

  // ─────── NR3 — Resposta direta a preço (não-evasiva) ───────
  {
    group: 'NR3. Resposta direta a preço',
    name: 'NR3.1 — não evade quando perguntado direto',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'qual o valor pra cortar com Tiago?',
    expects: out => {
      const checks = [];
      // Deve conter número/valor — não pode ser evasivo
      const hasValue = /\b(100|130|cem|R\$|reais|valor é|sai por)\b/i.test(out);
      if (!hasValue) checks.push('NR3 violado: resposta evasiva, não contém valor');
      // Evasivo típico: "deixa eu ver / vou consultar / aguarde / posso checar"
      const evasive = /(deixa eu ver|vou consultar|vou checar|aguarda|um momento)/i.test(out);
      if (evasive && !hasValue) checks.push('NR3 violado: resposta usa frase evasiva sem dar valor');
      return checks;
    }
  },

  // ─────── NR4 — Confirmação estruturada em bloco único ───────
  {
    group: 'NR4. Confirmação em bloco único',
    name: 'NR4.1 — mesmo cenário R4.2 reforçando NR4',
    context: ctx({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' }, historico: [
      { role: 'user', content: 'Cabelo e Barba com André sábado às 11h' },
      { role: 'assistant', content: 'Vou confirmar então.' }
    ]}),
    userMsg: 'pode confirmar',
    expects: out => {
      const checks = [];
      // Pode emitir tag direto — se a confirmação tripla já aconteceu, o output pode ser:
      //   "Confirmo aqui então 👀\n\n[BOOKING_CREATE ...]"
      // Esse "Confirmo aqui então 👀" não precisa de <break> — é uma linha só.
      const humanText = out.replace(/\[(BOOKING_[A-Z]+|HANDOFF_HUMAN)[^\]]*\]/gs, '').trim();
      const breaksInHuman = (humanText.match(/<break>/gi) || []).length;
      // Texto humano de confirmação deve ter 0 <break>
      if (breaksInHuman > 0 && /confirmo aqui|registrar isso/i.test(humanText)) {
        checks.push(`NR4 violado: texto humano de confirmação tem ${breaksInHuman} <break>`);
      }
      return checks;
    }
  },

  // ─────── A1 — Sinônimos de serviços (KB sinonimos-servicos.md) ───────
  {
    group: 'A1. Sinônimos de serviços',
    name: 'A1.1 — "queria fazer o pé sábado" → interpretar como Pedicure',
    context: ctx({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' } }),
    userMsg: 'queria fazer o pé sábado',
    expects: out => {
      const checks = [];
      const mentionsPedicure = /pedicure/i.test(out);
      const asksDisambig = /(depila|qual|quer dizer|você se refere)/i.test(out);
      // Aceita: ou interpreta como pedicure direto, ou pergunta pra desambiguar (regra do sinonimos-servicos.md)
      if (!mentionsPedicure && !asksDisambig) checks.push('A1 violado: não interpretou "pé" nem perguntou pra desambiguar');
      return checks;
    }
  },
  {
    group: 'A1. Sinônimos de serviços',
    name: 'A1.2 — "queria fazer a mão" → interpretar como Manicure',
    context: ctx({ dadosCliente: { id: 100, nome: 'Carla', telefone: '11999990000' } }),
    userMsg: 'queria fazer a mão amanhã',
    expects: out => {
      const checks = [];
      if (!/manicure/i.test(out)) checks.push('A1 violado: não interpretou "fazer a mão" como Manicure');
      return checks;
    }
  },

  // ─────── EXTRA — Saudação curta (bloco único permitido) ───────
  {
    group: 'R4 extra. Resposta curta sem quebra',
    name: 'R4.3 — pergunta simples (endereço) → bloco único OK',
    context: ctx({ dadosCliente: { id: 100, nome: 'Joao', telefone: '11999990000' } }),
    userMsg: 'qual o endereço?',
    expects: out => {
      const checks = [];
      const n = countBreaks(out);
      // Resposta curta — não obrigatório <break>. Apenas valida que não enche de break.
      if (n > 2) checks.push(`R4 risco: ${n} <break> em resposta simples (esperado 0-1)`);
      return checks;
    }
  }
];

async function callTess(context, userMsg) {
  const body = {
    messages: [{ role: 'user', content: `${context}\n\nMENSAGEM DO CLIENTE: ${userMsg}` }],
    wait_execution: true
  };
  const res = await fetch(TESS_URL, {
    method: 'POST',
    headers: tessScriptHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) throw new Error(`TESS ${res.status}: ${await res.text().catch(()=>'')}`);
  return res.json();
}

function extractOutput(json) {
  const r0 = json?.responses?.[0]?.output;
  if (r0 && r0.trim()) return r0;
  if (json?.output && String(json.output).trim()) return json.output;
  if (json?.response && String(json.response).trim()) return json.response;
  return `(SEM OUTPUT — raw: ${JSON.stringify(json).slice(0, 800)})`;
}

(async () => {
  if (!TOKEN) {
    console.error('❌ TESS_API_TOKEN não encontrado em backend/.env');
    process.exit(2);
  }
  console.log(`\n🧪 Bateria v3 TESS Conversa — agente ${AGENT_ID}`);
  console.log(`   prompt esperado no painel: tess-conversa-v3.md (v3.0.1)`);
  console.log(`${'═'.repeat(76)}\n`);
  const results = [];
  let lastGroup = '';
  let retries = 0;
  for (const t of TESTS) {
    if (t.group !== lastGroup) {
      console.log(`\n┌─ ${t.group} ${'─'.repeat(Math.max(0, 72 - t.group.length))}`);
      lastGroup = t.group;
    }
    console.log(`\n▶ ${t.name}`);
    console.log(`  cliente: "${t.userMsg.slice(0, 130)}${t.userMsg.length > 130 ? '…' : ''}"`);
    try {
      let json = await callTess(t.context, t.userMsg);
      let out = extractOutput(json);
      // Retry automático se resposta vazia (G7)
      if (!out || /^\(SEM OUTPUT/.test(out)) {
        retries++;
        console.log(`  🔁 RETRY (resposta vazia da API)`);
        json = await callTess(t.context, t.userMsg);
        out = extractOutput(json);
      }
      console.log(`  bot: ${out.slice(0, 400).replace(/\n/g, '\\n')}${out.length > 400 ? '…' : ''}`);
      const failures = t.expects(out);
      const status = failures.length === 0 ? 'PASS' : 'FAIL';
      if (status === 'PASS') console.log(`  ✅ PASS`);
      else {
        console.log(`  ❌ FAIL:`);
        failures.forEach(f => console.log(`     - ${f}`));
      }
      results.push({ group: t.group, name: t.name, userMsg: t.userMsg, out, failures, status });
    } catch (err) {
      console.log(`  💥 ERRO: ${err.message}`);
      results.push({ group: t.group, name: t.name, userMsg: t.userMsg, error: err.message, status: 'ERROR' });
    }
  }
  console.log(`\n${'═'.repeat(76)}`);
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const err = results.filter(r => r.status === 'ERROR').length;
  const total = results.length;
  const score = (pass / total).toFixed(2);
  console.log(`\n📊 Score agregado: ${pass}/${total} = ${score} (THRESHOLD_EVAL = 0.85)`);
  console.log(`   PASS: ${pass}   FAIL: ${fail}   ERROR: ${err}   RETRIES: ${retries}\n`);
  fs.writeFileSync('scripts/test-conversa-v3-results.json', JSON.stringify({ score: Number(score), pass, fail, err, retries, results }, null, 2));
  console.log('Detalhes em scripts/test-conversa-v3-results.json\n');
})();
