#!/usr/bin/env node
// Roda o teste 2 (cancelamento) 3x para detectar flake vs regressão.

import fs from 'node:fs';
try {
  const envText = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.TESS_API_TOKEN;
const AGENT_ID = '46589';
const URL = `https://api.tess.im/agents/${AGENT_ID}/execute`;
const TODAY = new Date().toISOString().slice(0, 10);

const context = `
CONTEXTO DINÂMICO (injetado pelo backend):
HOJE: ${TODAY}
SLOTS_DISPONIVEIS: []
SERVICOS: [{id:1,nome:"Corte Masculino",preco:85,duracaoMin:60}]
PROFISSIONAIS: [{id:5,nome:"Tiago Rocha"}]
DADOS_CLIENTE: {"id":100,"nome":"Carla","telefone":"11999990000","ultimoAgendamento":{"id":498220145,"servico":"Corte e Barba","dataHora":"2026-05-26T15:00:00-03:00"}}
HISTORICO_CONVERSA: []
`.trim();

async function call() {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: `${context}\n\nMENSAGEM DO CLIENTE: preciso cancelar meu horário de amanhã` }],
      wait_execution: true
    }),
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) throw new Error(`TESS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { output: json?.output ?? '', raw: json };
}

(async () => {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n────── Tentativa ${i} ──────`);
    try {
      const { output, raw } = await call();
      const isEmpty = !output || output.trim() === '';
      const hasTag = /\[BOOKING_CANCEL/.test(output);
      console.log(`output: ${isEmpty ? '(VAZIO)' : `"${output}"`}`);
      console.log(`vazio? ${isEmpty}  |  tem [BOOKING_CANCEL]? ${hasTag}`);
      if (isEmpty) {
        console.log(`raw keys: ${Object.keys(raw).join(', ')}`);
        console.log(`raw (snippet): ${JSON.stringify(raw).slice(0, 500)}`);
      }
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
    }
  }
})();
