const { test } = require('node:test');
const assert = require('node:assert');

process.env.TESS_WORKSPACE_ID ||= '1458234';

const {
  extractContactPhone,
  extractDirection,
  extractTimestampMs,
  buildLastSpeakerMap,
  clientSpokeLastKapso,
  fetchKapsoLastSpeaker,
  mapWithConcurrency,
  // Camada 2
  classifyConversation,
  fetchFutureBookings,
  lastClientMsgTs,
  formatArrival,
  renderDigest,
} = require('../supervisor');
const db = require('../db');

// Fixture só de teste — NÃO é ID de produção (94831 morto / Salvy / número novo).
const TEST_PNID = 'pnid-test-fixture';

// ============================================================================
// Supervisor v2 — Camada 1 (RE-DEV, fonte Kapso `kapso.direction`)
//
// ⚠️ LIÇÃO DO NO-OP: estes unit tests mockam a Kapso → NÃO satisfazem o AC11.
// A v1 passou 44/44 mockada e o filtro era morto em prod. AC11 (smoke em prod,
// `filtradas > 0` em dados REAIS) é o que comprova que a fonte carrega o sinal.
// Aqui validamos a LÓGICA: direção, join de telefone, fail-open e o reduce.
// ============================================================================

// ---- extractContactPhone: telefone do CONTATO (cliente) ----
// SHAPE REAL DE PROD (probe @devops 2026-05-29): a msg traz `kapso.phone_number` = telefone do
// CLIENTE nas DUAS direções (inbound from=cliente; outbound from=salão fixo, kapso.phone_number=cliente).
// Estes mocks usam o shape real; se a Kapso mudar o campo, um destes QUEBRA (era a armadilha da v1).
test('extractContactPhone: usa kapso.phone_number (campo REAL de prod) — inbound', () => {
  assert.equal(
    extractContactPhone({ from: '5511961401417', timestamp: 1780072982, kapso: { direction: 'inbound', phone_number: '5511961401417' } }),
    '5511961401417',
  );
});

test('extractContactPhone: outbound → kapso.phone_number é o CLIENTE (from é o salão fixo, NÃO há `to`)', () => {
  // Shape real outbound: from=número do salão (5511948319426), kapso.phone_number=cliente, sem campo `to`.
  assert.equal(
    extractContactPhone({ from: '5511948319426', kapso: { direction: 'outbound', phone_number: '5511943569567', origin: 'business_app' } }),
    '5511943569567',
  );
});

test('extractContactPhone: fallback inbound sem kapso.phone_number → usa `from`', () => {
  assert.equal(
    extractContactPhone({ from: '5511964540007', kapso: { direction: 'inbound' } }),
    '5511964540007',
  );
});

test('extractContactPhone: prefixa 55 (normalizePhoneBR) em telefone de 11 díg', () => {
  assert.equal(extractContactPhone({ kapso: { phone_number: '11964540007' } }), '5511964540007');
});

test('extractContactPhone: lixo → null (fail-open por item no chamador)', () => {
  assert.equal(extractContactPhone({ kapso: { phone_number: '123' } }), null);
  assert.equal(extractContactPhone(null), null);
});

// ---- extractDirection / extractTimestampMs (defensivos) ----
test('extractDirection: lê msg.direction ou kapso.direction', () => {
  assert.equal(extractDirection({ direction: 'inbound' }), 'inbound');
  assert.equal(extractDirection({ kapso: { direction: 'outbound' } }), 'outbound');
  assert.equal(extractDirection({}), null);
});

test('extractTimestampMs: epoch-segundos → ms; ISO → ms', () => {
  assert.equal(extractTimestampMs({ timestamp: 1700000000 }), 1700000000000); // segundos
  assert.equal(extractTimestampMs({ timestamp: 1700000000000 }), 1700000000000); // já ms
  assert.equal(extractTimestampMs({ created_at: '2026-05-29T10:00:00Z' }), Date.parse('2026-05-29T10:00:00Z'));
  assert.equal(extractTimestampMs({}), 0);
});

// ---- buildLastSpeakerMap: reduce por max-timestamp por telefone ----
test('buildLastSpeakerMap: guarda a direção da msg de MAIOR timestamp por telefone', () => {
  const msgs = [
    { kapso: { phone_number: '5511964540007', direction: 'inbound' }, timestamp: 100 },
    { kapso: { phone_number: '5511964540007', direction: 'outbound' }, timestamp: 200 }, // mais nova
    { kapso: { phone_number: '5518998240447', direction: 'outbound' }, timestamp: 50 },
    { kapso: { phone_number: '5518998240447', direction: 'inbound' }, timestamp: 60 }, // mais nova
  ];
  const { map, matchedPhones, messagesSeen, messagesWithTs } = buildLastSpeakerMap(msgs);
  assert.equal(map.get('5511964540007'), 'outbound'); // última foi do salão
  assert.equal(map.get('5518998240447'), 'inbound'); // última foi do cliente
  assert.equal(matchedPhones, 2);
  assert.equal(messagesSeen, 4);
  assert.equal(messagesWithTs, 4); // todas tinham timestamp parseável
});

test('buildLastSpeakerMap: conta msgs SEM timestamp parseável (guardrail do 4º no-op)', () => {
  const { messagesWithTs, messagesSeen } = buildLastSpeakerMap([
    { kapso: { phone_number: '5511964540007', direction: 'inbound' } }, // sem ts
    { kapso: { phone_number: '5518998240447', direction: 'outbound' }, timestamp: 100 },
  ]);
  assert.equal(messagesSeen, 2);
  assert.equal(messagesWithTs, 1);
});

test('buildLastSpeakerMap: ordem das msgs é irrelevante (só max-timestamp importa)', () => {
  const a = buildLastSpeakerMap([
    { kapso: { phone_number: '5511964540007', direction: 'outbound' }, timestamp: 200 },
    { kapso: { phone_number: '5511964540007', direction: 'inbound' }, timestamp: 100 },
  ]);
  assert.equal(a.map.get('5511964540007'), 'outbound');
});

test('buildLastSpeakerMap: ignora msgs sem telefone ou sem direção', () => {
  const { map } = buildLastSpeakerMap([
    { kapso: { phone_number: '123', direction: 'inbound' }, timestamp: 1 }, // telefone inválido
    { kapso: { phone_number: '5511964540007' }, timestamp: 1 }, // sem direção
  ]);
  assert.equal(map.size, 0);
});

// ---- AC2: clientSpokeLastKapso — excluir outbound, manter inbound, FAIL-OPEN ----
test('clientSpokeLastKapso: última msg INBOUND → mantém (cliente aguardando)', () => {
  const map = new Map([['5511964540007', 'inbound']]);
  assert.equal(clientSpokeLastKapso({ client_phone: '5511964540007' }, map), true);
});

test('clientSpokeLastKapso: última msg OUTBOUND → exclui (salão falou por último)', () => {
  const map = new Map([['5511964540007', 'outbound']]);
  assert.equal(clientSpokeLastKapso({ client_phone: '5511964540007' }, map), false);
});

test('clientSpokeLastKapso: cobre os baldes da recepção (já-respondida/agendada/sumiu = outbound → exclui)', () => {
  const map = new Map([
    ['5511111111111', 'outbound'], // já respondida
    ['5512222222222', 'outbound'], // já agendada (salão confirmou)
    ['5513333333333', 'outbound'], // cliente sumiu (salão pingou por último)
    ['5514444444444', 'inbound'], // cliente aguardando (acionável)
  ]);
  assert.equal(clientSpokeLastKapso({ client_phone: '5511111111111' }, map), false);
  assert.equal(clientSpokeLastKapso({ client_phone: '5512222222222' }, map), false);
  assert.equal(clientSpokeLastKapso({ client_phone: '5513333333333' }, map), false);
  assert.equal(clientSpokeLastKapso({ client_phone: '5514444444444' }, map), true);
});

test('clientSpokeLastKapso: FAIL-OPEN global — Kapso indisponível (map=null) → mantém TODAS', () => {
  assert.equal(clientSpokeLastKapso({ client_phone: '5511964540007' }, null), true);
});

test('clientSpokeLastKapso: FAIL-OPEN por item — telefone não casa no Map → mantém (nunca dropa por dúvida)', () => {
  const map = new Map([['5511964540007', 'outbound']]);
  // telefone diferente (variância 9º dígito, etc.) → não está no Map → mantém
  assert.equal(clientSpokeLastKapso({ client_phone: '5511888888888' }, map), true);
});

test('clientSpokeLastKapso: FAIL-OPEN por item — telefone da conversa não normaliza → mantém', () => {
  const map = new Map([['5511964540007', 'outbound']]);
  assert.equal(clientSpokeLastKapso({ client_phone: '123' }, map), true);
});

// ---- fetchKapsoLastSpeaker: orquestração com fetch injetado (sem rede real) ----
function fakeResponse(jsonBody, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  };
}

test('fetchKapsoLastSpeaker: monta o Map a partir de 1 página (shape REAL: data[]+kapso+paging)', async () => {
  // precisa de KAPSO_API_BASE_URL/KEY no env p/ não falhar no guard
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const nowSec = Math.floor(Date.now() / 1000); // epoch-segundos como a Kapso entrega
  const fetchImpl = async () => fakeResponse({
    data: [
      { from: '5511948319426', timestamp: nowSec, kapso: { phone_number: '5511964540007', direction: 'outbound', origin: 'business_app' } },
      { from: '5518998240447', timestamp: nowSec, kapso: { phone_number: '5518998240447', direction: 'inbound' } },
    ],
    paging: { next: null }, // 1 página só
  });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: TEST_PNID, lookbackHours: 24, fetchImpl });
  assert.equal(res.ok, true);
  assert.equal(res.map.get('5511964540007'), 'outbound'); // resposta manual do salão (business_app)
  assert.equal(res.map.get('5518998240447'), 'inbound');
  assert.equal(res.diag.distinct_phones_in_map, 2);
  assert.equal(res.diag.window_fully_covered, true); // paging.next=null → hasMore_exhausted
});

test('fetchKapsoLastSpeaker: SEGUE paging.next (keyset DESC) por 2 páginas e para', async () => {
  // Garante que o cursor REAL (paging.next) é seguido — não para na página 1 (risco #2 / no-op parcial).
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const nowSec = Math.floor(Date.now() / 1000);
  const calls = [];
  const fetchImpl = async (url) => {
    const sp = new URL(url).searchParams;
    // Guard de regressão: a API Kapso rejeita limit>100 (400 Invalid limit parameter — pego no smoke).
    assert.ok(Number(sp.get('limit')) <= 100, `limit deve ser <=100, veio ${sp.get('limit')}`);
    const after = sp.get('after');
    calls.push(after);
    if (!after) {
      // página 1 (mais recentes) → aponta p/ página 2 via paging.next
      return fakeResponse({
        data: [{ from: 's', timestamp: nowSec, kapso: { phone_number: '5511964540007', direction: 'inbound' } }],
        paging: { next: 'CURSOR_P2', cursors: { after: 'CURSOR_P2' } },
      });
    }
    // página 2 (mais antiga, ainda dentro da janela) → fim
    return fakeResponse({
      data: [{ from: 's', timestamp: nowSec - 10, kapso: { phone_number: '5518998240447', direction: 'outbound' } }],
      paging: { next: null },
    });
  };
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: TEST_PNID, lookbackHours: 24, fetchImpl });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, [null, 'CURSOR_P2']); // seguiu o cursor da p1 → p2
  assert.equal(res.map.get('5511964540007'), 'inbound');
  assert.equal(res.map.get('5518998240447'), 'outbound');
  assert.equal(res.diag.pages, 2);
  assert.equal(res.diag.window_fully_covered, true);
});

test('fetchKapsoLastSpeaker: FAIL-OPEN — fetch 5xx → ok=false, map=null (não derruba digest)', async () => {
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const fetchImpl = async () => fakeResponse({ error: 'boom' }, { ok: false, status: 503 });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: TEST_PNID, lookbackHours: 24, fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.map, null);
  assert.match(res.error, /503/);
});

test('fetchKapsoLastSpeaker: FAIL-OPEN — phone_number_id ausente → ok=false', async () => {
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: null, lookbackHours: 24, fetchImpl: async () => fakeResponse({}) });
  assert.equal(res.ok, false);
});

test('fetchKapsoLastSpeaker: FAIL-OPEN — msgs sem timestamp parseável → ok=false (4º no-op)', async () => {
  // Se o campo de ts da Kapso tiver outro nome, max-timestamp degrada p/ ordem-de-fetch.
  // Buscou msgs mas nenhuma com ts → trata como não-confiável → bypass loud (não filtra errado).
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const fetchImpl = async () => fakeResponse({
    data: [
      { from: 's', kapso: { phone_number: '5511964540007', direction: 'outbound' } }, // SEM ts
      { from: 's', kapso: { phone_number: '5518998240447', direction: 'inbound' } }, // SEM ts
    ],
    paging: { next: null },
  });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: TEST_PNID, lookbackHours: 24, fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.map, null);
  assert.match(res.error, /timestamps_unparseable/);
});

// ---- AC5: mapWithConcurrency (pool, ordem preservada, respeita o teto) ----
test('mapWithConcurrency: processa todos e preserva ordem', async () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  const out = await mapWithConcurrency(items, 3, async (x) => x * 10);
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
});

test('mapWithConcurrency: nunca excede o limite de concorrência', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);
  await mapWithConcurrency(items, 4, async (x) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return x;
  });
  assert.ok(maxInFlight <= 4, `maxInFlight=${maxInFlight} deveria ser <= 4`);
});

test('mapWithConcurrency: lista vazia → []', async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async (x) => x), []);
});

// ============================================================================
// Supervisor v2 — Camada 2 (input enriquecido AC6 + sinal booking AC3 + render AC8)
// ============================================================================

// ---- lastClientMsgTs: horário da última msg do CLIENTE ----
test('lastClientMsgTs: pega o ts da última msg role=user', () => {
  const conv = { messages: [
    { role: 'user', content: 'oi', ts: '2026-05-29T10:00:00Z' },
    { role: 'assistant', content: 'olá', ts: '2026-05-29T10:01:00Z' },
    { role: 'user', content: 'quero marcar', ts: '2026-05-29T10:05:00Z' },
  ] };
  assert.equal(lastClientMsgTs(conv), '2026-05-29T10:05:00Z');
});

test('lastClientMsgTs: sem msg do cliente → cai no last_ts', () => {
  assert.equal(lastClientMsgTs({ messages: [{ role: 'assistant', ts: 'x' }], last_ts: '2026-05-29T09:00:00Z' }), '2026-05-29T09:00:00Z');
  assert.equal(lastClientMsgTs({}), null);
});

// ---- formatArrival: HH:MM no fuso do salão ----
test('formatArrival: ISO → HH:MM (America/Sao_Paulo)', () => {
  // 2026-05-29T13:05:00Z = 10:05 em BRT (UTC-3)
  assert.equal(formatArrival('2026-05-29T13:05:00Z'), '10:05');
  assert.equal(formatArrival(null), null);
  assert.equal(formatArrival('lixo'), null);
});

// ---- fetchFutureBookings: Map por telefone normalizado, mais próximo, dedup ----
test('fetchFutureBookings: normaliza telefone e guarda o agendamento mais próximo', async () => {
  const orig = db.query;
  db.query = async () => ({ rows: [
    { client_phone: '5511964540007', scheduled_at: '2026-05-30T13:00:00Z', status: 'confirmed' },
    { client_phone: '5511964540007', scheduled_at: '2026-06-02T13:00:00Z', status: 'confirmed' }, // mais distante → ignorado
    { client_phone: '11978905161', scheduled_at: '2026-05-31T13:00:00Z', status: 'confirmed' }, // sem 55
  ] });
  try {
    const map = await fetchFutureBookings();
    assert.equal(map.get('5511964540007').tem, true);
    assert.equal(map.get('5511964540007').quando, '2026-05-30T13:00:00Z'); // o mais próximo (ASC)
    assert.equal(map.get('5511978905161').tem, true); // 55 prefixado
    assert.equal(map.size, 2);
  } finally { db.query = orig; }
});

test('fetchFutureBookings: erro de DB → Map vazio (fail-open, booking é só sinal)', async () => {
  const orig = db.query;
  db.query = async () => { throw new Error('db down'); };
  try {
    const map = await fetchFutureBookings();
    assert.equal(map.size, 0);
  } finally { db.query = orig; }
});

// ---- classifyConversation: injeta os 3 sinais novos no input (AC6) ----
test('classifyConversation: input carrega QUEM_FALOU_POR_ULTIMO, TEM_AGENDAMENTO, HORARIO', async () => {
  const origFetch = global.fetch;
  let capturedInput = null;
  global.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    capturedInput = JSON.parse(body.messages[0].content);
    return { ok: true, json: async () => ({ output: '{"decision":"escalate","priority_score":70,"categoria":"novo_agendamento","severity":"med","reason_for_human":"x","suggested_action":"y"}' }), text: async () => '' };
  };
  try {
    const verdict = await classifyConversation({
      phone: '5511964540007', client: { name: 'Ana', visit_count: 7 },
      messages: [{ role: 'user', content: 'quero corte novo', ts: 't' }],
      quemFalouPorUltimo: 'cliente',
      temAgendamento: { tem: true, quando: '2026-05-30T13:00:00Z', status: 'confirmed' },
      horarioUltimaMsgCliente: '2026-05-29T10:05:00Z',
    });
    assert.equal(capturedInput.QUEM_FALOU_POR_ULTIMO, 'cliente');
    assert.equal(capturedInput.TEM_AGENDAMENTO.tem, true);
    assert.equal(capturedInput.HORARIO_ULTIMA_MSG_CLIENTE, '2026-05-29T10:05:00Z');
    assert.equal(verdict.decision, 'escalate');
  } finally { global.fetch = origFetch; }
});

test('classifyConversation: sem sinais → defaults seguros (TEM_AGENDAMENTO.tem=false)', async () => {
  const origFetch = global.fetch;
  let capturedInput = null;
  global.fetch = async (_url, opts) => {
    capturedInput = JSON.parse(JSON.parse(opts.body).messages[0].content);
    return { ok: true, json: async () => ({ output: '{"decision":"ignore","priority_score":0,"categoria":"falso_positivo","severity":"low","reason_for_human":"","suggested_action":""}' }), text: async () => '' };
  };
  try {
    await classifyConversation({ phone: 'p', client: null, messages: [{ role: 'user', content: 'oi' }] });
    assert.equal(capturedInput.QUEM_FALOU_POR_ULTIMO, null);
    assert.deepEqual(capturedInput.TEM_AGENDAMENTO, { tem: false });
    assert.equal(capturedInput.HORARIO_ULTIMA_MSG_CLIENTE, null);
  } finally { global.fetch = origFetch; }
});

// ---- renderDigest: híbrido fura-fila (AC8) ----
test('renderDigest: vazio → mensagem positiva (nada fura a fila)', () => {
  const txt = renderDigest({ items: [], lookbackHours: 24 });
  assert.match(txt, /Nada fura a fila/i);
});

test('renderDigest: híbrido — "furam a fila" + horário de chegada + marcador de agendamento', () => {
  const txt = renderDigest({ items: [
    {
      phone: '5511964540007', client_name: 'Maria Silva',
      verdict: { categoria: 'novo_agendamento', reason_for_human: 'Quer corte novo com Érick', suggested_action: 'Oferecer horários' },
      score: 72, last_client_ts: '2026-05-29T13:05:00Z', tem_agendamento: { tem: false },
    },
    {
      phone: '5518998240447', client_name: null, // sem nome → só telefone
      verdict: { categoria: 'conflito_agenda', reason_for_human: 'Quer remarcar sábado', suggested_action: 'Reagendar' },
      score: 70, last_client_ts: '2026-05-29T14:30:00Z', tem_agendamento: { tem: true },
    },
  ], lookbackHours: 24 });
  assert.match(txt, /furam a fila/i);
  assert.match(txt, /atenda primeiro/i);
  assert.match(txt, /Maria Silva \(5511964540007\)/); // nome + telefone
  assert.match(txt, /chegou 10:05/);       // arrival do item 1 (BRT)
  assert.match(txt, /chegou 11:30/);       // arrival do item 2
  assert.match(txt, /já tem agendamento/); // marcador booking do item 2
  assert.match(txt, /ordem de chegada/i);  // rodapé FIFO
  // item 2 sem nome → só telefone (sem parênteses de nome)
  assert.match(txt, /\n 2\. 5518998240447 —/);
});

// ---- Camada 2.1: nome do cliente (contact_name Kapso + clients.name) ----
test('buildLastSpeakerMap: captura contact_name da Kapso por telefone', () => {
  const { contactNames } = buildLastSpeakerMap([
    { kapso: { phone_number: '5511964540007', direction: 'inbound', contact_name: 'Thayná Fernanda' }, timestamp: 100 },
    { kapso: { phone_number: '5511964540007', direction: 'outbound' }, timestamp: 200 }, // sem nome → não sobrescreve
    { kapso: { phone_number: '5518998240447', direction: 'inbound' }, timestamp: 50 }, // sem nome
  ]);
  assert.equal(contactNames.get('5511964540007'), 'Thayná Fernanda');
  assert.equal(contactNames.has('5518998240447'), false);
});

test('classifyConversation: clientName resolvido vai em DADOS_CLIENTE.nome (cobre cliente novo sem clients)', async () => {
  const origFetch = global.fetch;
  let captured = null;
  global.fetch = async (_url, opts) => {
    captured = JSON.parse(JSON.parse(opts.body).messages[0].content);
    return { ok: true, json: async () => ({ output: '{"decision":"ignore","priority_score":0,"categoria":"falso_positivo","severity":"low","reason_for_human":"","suggested_action":""}' }), text: async () => '' };
  };
  try {
    await classifyConversation({ phone: 'p', client: null, clientName: 'Fagner (WhatsApp)', messages: [{ role: 'user', content: 'oi' }] });
    assert.equal(captured.DADOS_CLIENTE.nome, 'Fagner (WhatsApp)'); // sem clients, usa o nome da Kapso
  } finally { global.fetch = origFetch; }
});
