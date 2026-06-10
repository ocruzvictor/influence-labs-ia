/**
 * Testes unitários para backend/lib/trinks-cache.js (story trinks-resiliencia-429).
 *
 *   node --test backend/test/trinks-cache.test.js
 *   ou: cd backend && npm test
 *
 * Cobre AC1/AC2/AC4/AC5/AC6 via fetch/sleep/now injetados (mock), sem rede.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTrinksCache } = require('../lib/trinks-cache');

// Response-like mock.
function mockRes(status, data, headers = {}) {
  const lower = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = String(headers[k]);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => (k.toLowerCase() in lower ? lower[k.toLowerCase()] : null) },
    json: async () => data,
  };
}

// Helper: cria client com fetch sequencial controlado + clock manual.
function makeClient({ responses = [], maxConcurrency = 3, maxRetries = 2 } = {}) {
  const calls = [];
  const sleeps = [];
  let clock = 1000;
  let i = 0;
  const fetchImpl = async (url) => {
    calls.push(url);
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === 'function' ? r() : r;
  };
  const client = createTrinksCache({
    baseUrl: 'https://t.test/v1',
    apiKey: 'k',
    estId: '243868',
    fetchImpl,
    sleepImpl: async (ms) => { sleeps.push(ms); },
    nowFn: () => clock,
    maxConcurrency,
    maxRetries,
  });
  return { client, calls, sleeps, setClock: (v) => { clock = v; }, advance: (d) => { clock += d; } };
}

test('AC1 — cache hit: 2ª leitura dentro do TTL não chama fetch de novo', async () => {
  const { client, calls } = makeClient({ responses: [mockRes(200, { data: [1] })] });
  const a = await client.cachedFetchTrinks('/servicos', 1000);
  const b = await client.cachedFetchTrinks('/servicos', 1000);
  assert.deepEqual(a, { data: [1] });
  assert.deepEqual(b, { data: [1] });
  assert.equal(calls.length, 1, 'fetch chamado só 1x (2ª veio do cache)');
  assert.equal(client.metrics.hits, 1);
  assert.equal(client.metrics.misses, 1);
});

test('AC1 — expiração: após o TTL, busca de novo', async () => {
  const h = makeClient({ responses: [mockRes(200, { data: ['x'] }), mockRes(200, { data: ['y'] })] });
  await h.client.cachedFetchTrinks('/servicos', 1000);
  h.advance(1500); // passa do TTL
  const b = await h.client.cachedFetchTrinks('/servicos', 1000);
  assert.deepEqual(b, { data: ['y'] });
  assert.equal(h.calls.length, 2);
});

test('AC2 — in-flight dedup: 2 chamadas concorrentes à mesma chave = 1 fetch', async () => {
  let resolveFetch;
  const gated = new Promise((r) => { resolveFetch = r; });
  const { client, calls } = makeClient({
    responses: [async () => { await gated; return mockRes(200, { data: ['z'] }); }],
  });
  const p1 = client.cachedFetchTrinks('/servicos', 1000);
  const p2 = client.cachedFetchTrinks('/servicos', 1000);
  resolveFetch();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1, { data: ['z'] });
  assert.deepEqual(r2, { data: ['z'] });
  assert.equal(calls.length, 1, 'concorrentes coalescem num só fetch');
});

test('AC3 — invalidate força nova busca', async () => {
  const h = makeClient({ responses: [mockRes(200, { data: [1] }), mockRes(200, { data: [2] })] });
  await h.client.cachedFetchTrinks(h.client.slotsCacheKey('2026-06-03'), 100000);
  h.client.invalidate(h.client.slotsCacheKey('2026-06-03'));
  const b = await h.client.cachedFetchTrinks(h.client.slotsCacheKey('2026-06-03'), 100000);
  assert.deepEqual(b, { data: [2] });
  assert.equal(h.calls.length, 2);
});

test('AC4 — limiter: nunca mais de N fetches simultâneos', async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const fetchImpl = async () => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 5)); // segura brevemente p/ forçar sobreposição
    concurrent--;
    return mockRes(200, { data: [] });
  };
  const client = createTrinksCache({
    baseUrl: 'https://t.test/v1', apiKey: 'k', estId: 'e',
    fetchImpl, sleepImpl: async () => {}, maxConcurrency: 2, maxRetries: 0,
  });
  // 5 chamadas a paths distintos (cache não interfere — fetchTrinks direto, sem cachedFetch)
  await Promise.all(['/a', '/b', '/c', '/d', '/e'].map((p) => client.fetchTrinks(p)));
  assert.equal(maxConcurrent, 2, `atingiu o teto de 2 simultâneas (observado ${maxConcurrent})`);
});

test('AC5 — retry em 429 SÓ com Retry-After (limite transitório), depois sucesso', async () => {
  const h = makeClient({
    responses: [mockRes(429, {}, { 'retry-after': '2' }), mockRes(200, { data: ['ok'] })],
    maxRetries: 2,
  });
  const r = await h.client.fetchTrinks('/servicos');
  assert.deepEqual(r, { data: ['ok'] });
  assert.deepEqual(h.sleeps, [2000], 'esperou Retry-After=2s');
  assert.equal(h.client.metrics.retries, 1);
});

test('AC5 — 429 SEM Retry-After (cap mensal) → falha rápido, NÃO retenta (não queima cota)', async () => {
  const h = makeClient({ responses: [mockRes(429, {})], maxRetries: 3 });
  await assert.rejects(() => h.client.fetchTrinks('/servicos'), /Trinks 429/);
  assert.equal(h.calls.length, 1, 'só 1 chamada — sem retry sem Retry-After');
  assert.equal(h.sleeps.length, 0, 'não dormiu');
  assert.equal(h.client.metrics.retries, 0);
});

test('AC5 — 429 com Retry-After persistente: retenta até maxRetries e desiste', async () => {
  const h = makeClient({ responses: [mockRes(429, {}, { 'retry-after': '1' })], maxRetries: 2 });
  await assert.rejects(() => h.client.fetchTrinks('/servicos'), /Trinks 429/);
  // 1 inicial + 2 retries = 3 chamadas
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.sleeps, [1000, 1000]);
});

test('AC6 — erro não-429 (500) lança imediatamente, sem retry', async () => {
  const h = makeClient({ responses: [mockRes(500, {})], maxRetries: 3 });
  await assert.rejects(() => h.client.fetchTrinks('/servicos'), /Trinks 500/);
  assert.equal(h.calls.length, 1, 'não retenta em 5xx');
  assert.equal(h.sleeps.length, 0);
});

test('AC6 — fetcher que lança não cacheia (próxima leitura tenta de novo)', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n++;
    if (n === 1) return mockRes(500, {});
    return mockRes(200, { data: ['recuperou'] });
  };
  const client = createTrinksCache({
    baseUrl: 'https://t.test/v1', apiKey: 'k', estId: 'e',
    fetchImpl, sleepImpl: async () => {}, maxRetries: 0,
  });
  await assert.rejects(() => client.cachedFetchTrinks('/servicos', 100000));
  const ok = await client.cachedFetchTrinks('/servicos', 100000);
  assert.deepEqual(ok, { data: ['recuperou'] }, 'erro não foi cacheado');
});
