const { test } = require('node:test');
const assert = require('node:assert');

const {
  extractContactPhone,
  extractDirection,
  extractTimestampMs,
  buildLastSpeakerMap,
  clientSpokeLastKapso,
  fetchKapsoLastSpeaker,
  mapWithConcurrency,
} = require('../supervisor');

// ============================================================================
// Supervisor v2 — Camada 1 (RE-DEV, fonte Kapso `kapso.direction`)
//
// ⚠️ LIÇÃO DO NO-OP: estes unit tests mockam a Kapso → NÃO satisfazem o AC11.
// A v1 passou 44/44 mockada e o filtro era morto em prod. AC11 (smoke em prod,
// `filtradas > 0` em dados REAIS) é o que comprova que a fonte carrega o sinal.
// Aqui validamos a LÓGICA: direção, join de telefone, fail-open e o reduce.
// ============================================================================

// ---- extractContactPhone: telefone do CONTATO (cliente), direction-aware ----
test('extractContactPhone: usa phone do contato/conversa quando presente', () => {
  assert.equal(
    extractContactPhone({ conversation: { phone_number: '5518998240447' }, kapso: { direction: 'outbound' } }),
    '5518998240447',
  );
});

test('extractContactPhone: outbound → cliente é o `to` (NUNCA o from cego do salão)', () => {
  // from = número do salão; to = cliente. Sem campo de contato → fallback por direção.
  assert.equal(
    extractContactPhone({ from: '551130000000', to: '5511964540007', kapso: { direction: 'outbound' } }),
    '5511964540007',
  );
});

test('extractContactPhone: inbound → cliente é o `from`', () => {
  assert.equal(
    extractContactPhone({ from: '5511964540007', to: '551130000000', kapso: { direction: 'inbound' } }),
    '5511964540007',
  );
});

test('extractContactPhone: prefixa 55 (normalizePhoneBR) em telefone de 11 díg', () => {
  assert.equal(extractContactPhone({ conversation: { phone_number: '11964540007' } }), '5511964540007');
});

test('extractContactPhone: lixo → null (fail-open por item no chamador)', () => {
  assert.equal(extractContactPhone({ conversation: { phone_number: '123' } }), null);
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
    { conversation: { phone_number: '5511964540007' }, direction: 'inbound', timestamp: 100 },
    { conversation: { phone_number: '5511964540007' }, direction: 'outbound', timestamp: 200 }, // mais nova
    { conversation: { phone_number: '5518998240447' }, direction: 'outbound', timestamp: 50 },
    { conversation: { phone_number: '5518998240447' }, direction: 'inbound', timestamp: 60 }, // mais nova
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
    { conversation: { phone_number: '5511964540007' }, direction: 'inbound' }, // sem ts
    { conversation: { phone_number: '5518998240447' }, direction: 'outbound', timestamp: 100 },
  ]);
  assert.equal(messagesSeen, 2);
  assert.equal(messagesWithTs, 1);
});

test('buildLastSpeakerMap: ordem das msgs é irrelevante (só max-timestamp importa)', () => {
  const a = buildLastSpeakerMap([
    { conversation: { phone_number: '5511964540007' }, direction: 'outbound', timestamp: 200 },
    { conversation: { phone_number: '5511964540007' }, direction: 'inbound', timestamp: 100 },
  ]);
  assert.equal(a.map.get('5511964540007'), 'outbound');
});

test('buildLastSpeakerMap: ignora msgs sem telefone ou sem direção', () => {
  const { map } = buildLastSpeakerMap([
    { conversation: { phone_number: '123' }, direction: 'inbound', timestamp: 1 }, // telefone inválido
    { conversation: { phone_number: '5511964540007' }, timestamp: 1 }, // sem direção
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

test('clientSpokeLastKapso: cobre os baldes do Gabriel (já-respondida/agendada/sumiu = outbound → exclui)', () => {
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

test('fetchKapsoLastSpeaker: monta o Map a partir de 1 página (sem cursor)', async () => {
  // precisa de KAPSO_API_BASE_URL/KEY no env p/ não falhar no guard
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const now = Date.now();
  const fetchImpl = async () => fakeResponse({
    data: [
      { conversation: { phone_number: '5511964540007' }, direction: 'outbound', timestamp: now },
      { conversation: { phone_number: '5518998240447' }, direction: 'inbound', timestamp: now },
    ],
    meta: { has_more: false },
  });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: '1016003164939443', lookbackHours: 24, fetchImpl });
  assert.equal(res.ok, true);
  assert.equal(res.map.get('5511964540007'), 'outbound');
  assert.equal(res.map.get('5518998240447'), 'inbound');
  assert.equal(res.diag.distinct_phones_in_map, 2);
});

test('fetchKapsoLastSpeaker: FAIL-OPEN — fetch 5xx → ok=false, map=null (não derruba digest)', async () => {
  process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai';
  process.env.KAPSO_API_KEY = 'test-key';
  const fetchImpl = async () => fakeResponse({ error: 'boom' }, { ok: false, status: 503 });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: '1016003164939443', lookbackHours: 24, fetchImpl });
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
      { conversation: { phone_number: '5511964540007' }, direction: 'outbound' }, // SEM ts
      { conversation: { phone_number: '5518998240447' }, direction: 'inbound' }, // SEM ts
    ],
    meta: { has_more: false },
  });
  const res = await fetchKapsoLastSpeaker({ phoneNumberId: '1016003164939443', lookbackHours: 24, fetchImpl });
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
