const { test } = require('node:test');
const assert = require('node:assert');

const { clientSpokeLast, mapWithConcurrency } = require('../supervisor');

// ---- AC2: clientSpokeLast (cliente falou por último = role 'user' na última msg) ----
test('clientSpokeLast: true quando última msg é do cliente (user)', () => {
  assert.equal(
    clientSpokeLast({ messages: [{ role: 'assistant' }, { role: 'user' }] }),
    true,
  );
  assert.equal(clientSpokeLast({ messages: [{ role: 'user' }] }), true);
});

test('clientSpokeLast: false quando salão/bot falou por último (assistant)', () => {
  assert.equal(
    clientSpokeLast({ messages: [{ role: 'user' }, { role: 'assistant' }] }),
    false,
  );
});

test('clientSpokeLast: false em conversa vazia / sem messages', () => {
  assert.equal(clientSpokeLast({ messages: [] }), false);
  assert.equal(clientSpokeLast({}), false);
  assert.equal(clientSpokeLast(null), false);
});

test('clientSpokeLast: cobre os baldes do Gabriel (já-respondida/agendada/sumiu = salão por último → false)', () => {
  // "já respondida": salão respondeu por último
  assert.equal(clientSpokeLast({ messages: [{ role: 'user' }, { role: 'assistant' }] }), false);
  // "cliente sumiu": salão perguntou, cliente não voltou → salão por último
  assert.equal(
    clientSpokeLast({ messages: [{ role: 'user' }, { role: 'assistant' }, { role: 'assistant' }] }),
    false,
  );
  // "cliente aguardando" (acionável): cliente mandou e espera
  assert.equal(clientSpokeLast({ messages: [{ role: 'assistant' }, { role: 'user' }] }), true);
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
