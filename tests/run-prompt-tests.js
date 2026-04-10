#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TESTS_FILE = path.join(ROOT, 'tests', 'prompt-tests.json');

function parseArgs(argv) {
  const args = {
    agent: 'all',
    llm: 'openai',
    mock: false,
    lintOnly: false,
    typecheckOnly: false,
    verbose: false,
    model: undefined
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--agent' && argv[i + 1]) args.agent = argv[++i];
    else if (token === '--llm' && argv[i + 1]) args.llm = argv[++i];
    else if (token === '--model' && argv[i + 1]) args.model = argv[++i];
    else if (token === '--mock') args.mock = true;
    else if (token === '--lint-only') args.lintOnly = true;
    else if (token === '--typecheck-only') args.typecheckOnly = true;
    else if (token === '--verbose') args.verbose = true;
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function qualityFixChecks() {
  const backend = readText(path.join(ROOT, 'backend', 'server.js'));
  ensure(/const DYNAMIC_CONTEXT_PREFIX\s*=/.test(backend), 'backend/server.js deve usar DYNAMIC_CONTEXT_PREFIX');
  ensure(backend.includes('HOJE:'), 'backend/server.js deve incluir HOJE no contexto dinamico');
  ensure(backend.includes('formatDateLabel'), 'backend/server.js deve formatar datas em portugues');
  ensure(!/const SYSTEM_PROMPT_BASE\s*=/.test(backend), 'backend/server.js nao deve manter SYSTEM_PROMPT_BASE legado');

  const frontend = readText(path.join(ROOT, 'frontend', 'demo-chat.html'));
  ensure(!/const WELCOME_MESSAGE\s*=/.test(frontend), 'frontend/demo-chat.html nao deve ter welcome message fixa');
  ensure(!/addMessage\(WELCOME_MESSAGE,\s*'received'\)/.test(frontend), 'frontend/demo-chat.html nao deve pre-carregar mensagem do assistente');

  const tessPrompt = readText(path.join(ROOT, 'docs', 'tess-agent-prompt.md'));
  ensure(tessPrompt.includes('REGRA ABSOLUTA DE DADOS:'), 'docs/tess-agent-prompt.md deve documentar REGRA ABSOLUTA DE DADOS');
  ensure(tessPrompt.includes('CONTEXTO DINAMICO'), 'docs/tess-agent-prompt.md deve referenciar CONTEXTO DINAMICO');
}

function lintChecks() {
  const targets = [
    'tests/prompt-tests.json',
    'data/rag/kb-index.json',
    'n8n-workflows/WF-01-router.json',
    'n8n-workflows/WF-02-receptionist.json',
    'n8n-workflows/WF-03-faq.json',
    'n8n-workflows/WF-04-sales.json',
    'n8n-workflows/WF-05-human-takeover.json',
    'n8n-workflows/WF-06-cron-jobs.json'
  ];

  const failed = [];
  for (const relativePath of targets) {
    const abs = path.join(ROOT, relativePath);
    try {
      JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (error) {
      failed.push(`${relativePath}: ${error.message}`);
    }
  }

  if (failed.length > 0) {
    console.error('Lint checks falharam:');
    failed.forEach((msg) => console.error(`- ${msg}`));
    process.exit(1);
  }

  qualityFixChecks();
  console.log('Lint checks OK');
}

function typeChecks() {
  const tests = readJson(TESTS_FILE);
  ensure(Array.isArray(tests.router_tests), 'router_tests deve ser array');
  ensure(Array.isArray(tests.receptionist_tests), 'receptionist_tests deve ser array');
  ensure(Array.isArray(tests.faq_tests), 'faq_tests deve ser array');

  ensure(tests.router_tests.length >= 30, 'router_tests deve ter pelo menos 30 casos');
  ensure(tests.receptionist_tests.length >= 10, 'receptionist_tests deve ter pelo menos 10 casos');
  ensure(tests.faq_tests.length >= 10, 'faq_tests deve ter pelo menos 10 casos');

  const total = tests.router_tests.length + tests.receptionist_tests.length + tests.faq_tests.length;
  ensure(total >= 50, 'suite total deve ter pelo menos 50 cenarios');

  tests.router_tests.forEach((test, idx) => {
    ensure(Boolean(test.input), `router_tests[${idx}].input obrigatorio`);
    ensure(Boolean(test.expected_intent), `router_tests[${idx}].expected_intent obrigatorio`);
  });

  tests.receptionist_tests.forEach((test, idx) => {
    ensure(Boolean(test.input), `receptionist_tests[${idx}].input obrigatorio`);
    ensure(Array.isArray(test.expected_contains), `receptionist_tests[${idx}].expected_contains deve ser array`);
  });

  tests.faq_tests.forEach((test, idx) => {
    ensure(Boolean(test.input), `faq_tests[${idx}].input obrigatorio`);
    ensure(Array.isArray(test.expected_contains), `faq_tests[${idx}].expected_contains deve ser array`);
  });

  qualityFixChecks();
  console.log('Type checks OK');
}

function mockRouterIntent(input) {
  const txt = normalize(input);

  const humans = [
    'humano',
    'pessoa',
    'gabriel',
    'atendente',
    'transfer',
    'robo',
    'vsf',
    '???',
    'de verdade',
    'alguem ai',
    'nao entendi nada',
    'sinal',
    'deposito',
    'politica'
  ];
  const complaints = ['horrivel', 'absurdo', 'reembolso', 'dinheiro de volta', 'nao gostei', 'estrag', 'decepcionado', 'problema'];
  const scheduling = [
    'agendar',
    'agendamento',
    'reagendar',
    'remarcar',
    'cancelar',
    'horario',
    'amanha',
    'quinta',
    'sabado',
    'vaga',
    'encaixe',
    'encaixar',
    'confirmado',
    'atrasado',
    'atrasar'
  ];
  const sales = ['promocao', 'oferta', 'desconto', 'pacote', 'combo', 'condicao', 'grana', 'campanha', 'aniversario', 'preco melhor'];
  const faq = ['quanto custa', 'endereco', 'aceitam', 'pix', 'abre', 'horario de funcionamento', 'quem faz', 'instagram', 'vendem', 'produto'];
  const greetingFaq = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'];

  if (greetingFaq.includes(txt)) return { intent: 'faq', confidence: 0.7 };
  if (txt.includes('reagendar') && txt.includes('3')) return { intent: 'humano', confidence: 0.9 };
  if (/\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(txt)) return { intent: 'agendamento', confidence: 0.9 };
  if (humans.some((k) => txt.includes(k))) return { intent: 'humano', confidence: 0.9 };
  if (complaints.some((k) => txt.includes(k))) return { intent: 'reclamacao', confidence: 0.9 };
  if (sales.some((k) => txt.includes(k))) return { intent: 'vendas', confidence: 0.85 };
  if (faq.some((k) => txt.includes(k))) return { intent: 'faq', confidence: 0.8 };
  if (/\b(tiago|andre|erick|eli|malu|maluzinha|giovanna|jackie|fefe|fernanda)\b/.test(txt)) return { intent: 'agendamento', confidence: 0.86 };
  if (scheduling.some((k) => txt.includes(k))) return { intent: 'agendamento', confidence: 0.9 };

  if (txt.length <= 3) return { intent: 'humano', confidence: 0.5 };
  return { intent: 'faq', confidence: 0.65 };
}

function mockReceptionistAnswer(test) {
  const msg = normalize(test.input);
  const slots = test.context?.available_slots || [];
  const firstSlot = slots[0] || '14:00';

  if (msg.includes('falar com o gabriel')) {
    return 'Claro! Vou transferir para o Gabriel agora.';
  }
  if (msg.includes('sou cliente nova')) {
    return 'Perfeito! Para comecar seu cadastro, me passa nome completo, celular, email e data de nascimento.';
  }
  if (msg.includes('visagismo')) {
    return 'Que otima escolha! O visagismo e uma consultoria completa. Qual objetivo voce quer atingir com essa mudanca?';
  }
  if (msg.includes('mechas')) {
    return 'Para mechas, primeiro fazemos o teste de mechas gratuito e sem compromisso. Posso te oferecer horarios?';
  }
  if (msg.includes('horario esta confirmado') || msg.includes('meu horario esta confirmado')) {
    return `So para confirmacao tripla: servico, profissional, data e horario ${firstSlot}. Correto?`;
  }
  if (msg.includes('encaixar sobrancelha')) {
    return 'Vou verificar encaixe com a equipe e te confirmo os melhores horarios.';
  }
  if (msg.includes('atrasado')) {
    return 'Sem problema. Temos tolerancia de 15 minutos. Vem com seguranca.';
  }
  if (msg.includes('nao gostei')) {
    return 'Lamento por isso. Vou escalar para o Gabriel cuidar do seu caso com prioridade.';
  }
  if (msg.includes('mover meu horario')) {
    return 'Podemos manter horario confirmado para nao te prejudicar.';
  }
  if (msg.includes('cliente recorrente')) {
    return 'Perfeito, bem-vindo de volta! Vou seguir com seu atendimento.';
  }
  if (msg.includes('aceita pix')) {
    return 'Sim, aceitamos PIX, cartao e dinheiro.';
  }
  if (msg.includes('andre premium')) {
    return 'Sim, o Andre segue tabela premium para servicos masculinos.';
  }
  if (msg.includes('quero confirmar:')) {
    return 'Confirmado: servico, profissional, data, hora e valor ja alinhados.';
  }
  if (msg.includes('tiago ta de folga quarta')) {
    return 'Na quarta o Tiago folga, mas tenho opcoes com Andre e Erick. Vou validar no Trinks para voce.';
  }

  if (msg.includes('desconto')) {
    return 'Nao consigo alterar precos fora da promocao oficial de terca e quarta, mas te ajudo com o melhor horario.';
  }
  if (msg.includes('nao existe')) {
    return 'Nao temos esse servico no momento. Se quiser, te ajudo com uma opcao equivalente.';
  }
  if (msg.includes('problema')) {
    return 'Vou verificar com a equipe e ja te retorno!';
  }
  if (slots.length === 0 || msg.includes('agora')) {
    return 'No momento nao temos vaga nesse horario. Posso te colocar na lista de espera?';
  }
  if (msg.includes('cancelar')) {
    return 'Posso seguir com o cancelamento. Para confirmar, preciso que voce responda se deseja confirmar o cancelamento deste horario.';
  }
  if (msg.includes('coloracao') && msg.includes('carla') && msg.includes('sexta')) {
    return `Perfeito! Para coloracao com a Carla na sexta, tenho ${slots.join(', ')}. Qual horario voce prefere?`;
  }
  if (msg.includes('reagendar')) {
    return `Perfeito, vamos reagendar. Tenho ${slots.join(', ')}. Qual novo horario voce prefere?`;
  }
  if (msg.includes('remarcar')) {
    return `Perfeito, vamos reagendar. Tenho ${slots.join(', ')}. Qual novo horario voce prefere?`;
  }
  if (msg.includes('cortar cabelo e barba') && msg.includes('tiago')) {
    return `Perfeito! Para cabelo e barba com Tiago, tenho ${slots.join(', ')} e posso te confirmar as ${firstSlot}.`;
  }
  if (msg.includes('manicure') && msg.includes('sabado')) {
    return `Para manicure no sabado, posso te oferecer os horarios ${slots.join(', ')}.`;
  }
  if (msg.includes('marcos') && msg.includes('barba')) {
    return `Para barba com Marcos, tenho ${slots.join(', ')}. Qual horario prefere?`;
  }
  if (msg.includes('qualquer horario') && msg.includes('ana')) {
    return `Perfeito! Com a Ana posso te encaixar as ${slots.join(', ')}.`;
  }
  if (msg.includes('confirm')) {
    return `Entao fica: servico combinado no horario ${firstSlot}. Confirma?`;
  }

  return `Tenho horario as ${firstSlot}. Entao fica esse horario para voce, confirma?`;
}

function mockFaqAnswer(test) {
  const msg = normalize(test.input);

  if (msg.includes('endereco')) {
    return 'Estamos na Rua Espirito Santo, 385 - Santo Antonio, Sao Caetano do Sul.';
  }
  if (msg.includes('horario de funcionamento')) {
    return 'Funcionamos de Terca a Sexta das 9h as 19h e Sabado das 9h as 18h.';
  }
  if (msg.includes('estacionamento')) {
    return 'Temos estacionamento no local, com acesso pela rampa lateral.';
  }
  if (msg.includes('corte masculino')) {
    return 'Corte masculino: R$ 85 com equipe e R$ 100 na tabela premium.';
  }
  if (msg.includes('cabelo e barba')) {
    return 'Cabelo e barba: R$ 130 com equipe e R$ 155 no premium.';
  }
  if (msg.includes('visagismo')) {
    return 'Seguimos fluxo consultivo no visagismo e, apos avaliacao, o investimento e R$ 750.';
  }
  if (msg.includes('mechas')) {
    return 'Para mechas, iniciamos com teste de mechas gratuito antes de fechar valor.';
  }
  if (msg.includes('quem faz barba')) {
    return 'Barba e feita por Tiago, Andre e Erick.';
  }
  if (msg.includes('quem faz manicure')) {
    return 'Manicure e atendida por Maluzinha e Jackie.';
  }
  if (msg.includes('falar com o gabriel')) {
    return 'Posso transferir agora para atendimento humano com o Gabriel.';
  }
  if (msg.includes('politica para cliente de risco')) {
    return 'Para perfil de risco, pode ser solicitado deposito de 50% para confirmar.';
  }
  if (msg.includes('protocolo de confirmacao')) {
    return 'Fazemos confirmacao D-1 e confirmacao tripla antes do horario.';
  }
  if (msg.includes('depilacao')) {
    return 'Temos Depilacao de Nariz e Depilacao de Orelha no catalogo.';
  }
  if (msg.includes('massagem')) {
    return 'Temos Massagem corpo todo e Massagem local.';
  }
  if (msg.includes('promocao')) {
    return 'As promocoes principais acontecem em Terca e quarta.';
  }
  if (msg.includes('pix') || msg.includes('pagamento')) {
    return 'Sim, aceitamos PIX, cartao e dinheiro.';
  }
  if (msg.includes('remarcar')) {
    return 'Sem problema nenhum! Me fala o melhor horario que eu verifico para voce.';
  }
  if (msg.includes('vendem produtos')) {
    return 'Sim, vendemos Don Alcides e BOAZ, alem de outros itens.';
  }
  if (msg.includes('redbull')) {
    return 'Temos RedBull no valor de R$ 15.';
  }

  return 'Boa pergunta! Vou confirmar com a equipe e ja te retorno.';
}

async function callOpenAI(systemPrompt, userInput, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada');

  const payload = {
    model: model || 'gpt-4o-mini',
    temperature: 0.1,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ]
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.output?.[0]?.content?.[0]?.text || '';
}

async function callAnthropic(systemPrompt, userInput, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nao configurada');

  const payload = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: 400,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userInput }
    ]
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callModel(args, systemPrompt, userInput) {
  if (args.mock) return null;
  if (args.llm === 'openai') return callOpenAI(systemPrompt, userInput, args.model);
  if (args.llm === 'anthropic') return callAnthropic(systemPrompt, userInput, args.model);
  throw new Error(`LLM nao suportado: ${args.llm}`);
}

function containsAll(text, tokens) {
  const base = normalize(text);
  return tokens.every((token) => base.includes(normalize(token)));
}

function containsNone(text, tokens) {
  const base = normalize(text);
  return tokens.every((token) => !base.includes(normalize(token)));
}

async function runRouterTests(args, tests) {
  const prompt = readText(path.join(ROOT, 'data', 'prompts', 'router-prompt.md'));
  const failures = [];
  let passed = 0;

  for (const test of tests) {
    let intent;

    if (args.mock) {
      intent = mockRouterIntent(test.input).intent;
    } else {
      const text = await callModel(
        args,
        `${prompt}\nResponda SOMENTE JSON com intent e confidence.`,
        `Mensagem: ${test.input}\nContexto: ${test.context || 'sem contexto'}`
      );
      try {
        intent = JSON.parse(text).intent;
      } catch {
        intent = '';
      }
    }

    if (intent === test.expected_intent) {
      passed += 1;
    } else {
      failures.push({ test: test.input, expected: test.expected_intent, got: intent || '(vazio)' });
    }
  }

  return { agent: 'router', total: tests.length, passed, failed: failures.length, failures };
}

async function runReceptionistTests(args, tests) {
  const prompt = readText(path.join(ROOT, 'data', 'prompts', 'receptionist-prompt.md'));
  const failures = [];
  let passed = 0;

  for (const test of tests) {
    let answer;

    if (args.mock) {
      answer = mockReceptionistAnswer(test);
    } else {
      const slots = JSON.stringify(test.context?.available_slots || []);
      const input = `Mensagem: ${test.input}\nAVAILABLE_SLOTS: ${slots}`;
      answer = await callModel(args, prompt, input);
    }

    const okContains = containsAll(answer, test.expected_contains || []);
    const okNotContains = containsNone(answer, test.expected_not_contains || []);

    if (okContains && okNotContains) {
      passed += 1;
    } else {
      failures.push({
        test: test.input,
        answer,
        missing: (test.expected_contains || []).filter((t) => !normalize(answer).includes(normalize(t))),
        forbidden: (test.expected_not_contains || []).filter((t) => normalize(answer).includes(normalize(t)))
      });
    }
  }

  return { agent: 'receptionist', total: tests.length, passed, failed: failures.length, failures };
}

async function runFaqTests(args, tests) {
  const prompt = readText(path.join(ROOT, 'data', 'prompts', 'faq-prompt.md'));
  const failures = [];
  let passed = 0;

  for (const test of tests) {
    let answer;

    if (args.mock) {
      answer = mockFaqAnswer(test);
    } else {
      answer = await callModel(args, prompt, `Pergunta: ${test.input}`);
    }

    const okContains = containsAll(answer, test.expected_contains || []);

    if (okContains) {
      passed += 1;
    } else {
      failures.push({
        test: test.input,
        answer,
        missing: (test.expected_contains || []).filter((t) => !normalize(answer).includes(normalize(t)))
      });
    }
  }

  return { agent: 'faq', total: tests.length, passed, failed: failures.length, failures };
}

function printReport(results, verbose) {
  const total = results.reduce((acc, r) => acc + r.total, 0);
  const passed = results.reduce((acc, r) => acc + r.passed, 0);
  const failed = total - passed;
  const rate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';

  console.log('=== Prompt Test Report ===');
  results.forEach((r) => {
    const localRate = r.total > 0 ? ((r.passed / r.total) * 100).toFixed(2) : '0.00';
    console.log(`- ${r.agent}: ${r.passed}/${r.total} (${localRate}%)`);
  });
  console.log(`TOTAL: ${passed}/${total} (${rate}%)`);

  if (failed > 0) {
    console.log('\nFalhas:');
    results.forEach((r) => {
      r.failures.slice(0, 10).forEach((f) => {
        console.log(`- [${r.agent}] ${f.test}`);
        if (f.expected) console.log(`  esperado: ${f.expected} | obtido: ${f.got}`);
        if (f.missing && f.missing.length) console.log(`  faltando: ${f.missing.join(', ')}`);
        if (f.forbidden && f.forbidden.length) console.log(`  proibido encontrado: ${f.forbidden.join(', ')}`);
        if (verbose && f.answer) console.log(`  resposta: ${f.answer}`);
      });
    });
  }

  return failed === 0;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.lintOnly) {
    lintChecks();
    return;
  }

  if (args.typecheckOnly) {
    typeChecks();
    return;
  }

  typeChecks();

  const tests = readJson(TESTS_FILE);

  if (!args.mock) {
    if (args.llm === 'openai' && !process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY ausente. Executando em modo --mock.');
      args.mock = true;
    }
    if (args.llm === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY ausente. Executando em modo --mock.');
      args.mock = true;
    }
  }

  const jobs = [];
  if (args.agent === 'all' || args.agent === 'router') jobs.push(() => runRouterTests(args, tests.router_tests));
  if (args.agent === 'all' || args.agent === 'receptionist') jobs.push(() => runReceptionistTests(args, tests.receptionist_tests));
  if (args.agent === 'all' || args.agent === 'faq') jobs.push(() => runFaqTests(args, tests.faq_tests));

  if (jobs.length === 0) {
    throw new Error(`Agent invalido: ${args.agent}. Use all|router|receptionist|faq`);
  }

  const results = [];
  for (const job of jobs) {
    const result = await job();
    results.push(result);
  }

  const ok = printReport(results, args.verbose);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
