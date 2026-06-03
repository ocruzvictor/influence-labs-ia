/**
 * Camada de resiliência Trinks para o hot-path do bot (story salon-whatsapp-trinks-resiliencia-429).
 *
 * NÃO confundir com lib/trinks-client.js (Story 1.6) — aquele é do worker (processo
 * separado, batch/paginação). Este é do server.js (resposta ao cliente em tempo-real).
 *
 * Raiz do 429: cada mensagem dispara ~7 chamadas Trinks concorrentes (5 dias de slots
 * + profissionais + serviços), sem cache e sem retry → rajada estoura o rate-limit.
 *
 * Encapsula:
 *   - Limiter de concorrência (semáforo): nunca > maxConcurrency chamadas simultâneas.
 *   - Retry em 429 respeitando Retry-After (fallback backoff exponencial).
 *   - Cache TTL + in-flight dedup (coalesce de chamadas concorrentes à mesma chave).
 *
 * fetch/sleep injetáveis para testes unitários (mock), sem subir o servidor.
 */

function createTrinksCache({
  baseUrl,
  apiKey,
  estId,
  fetchImpl,
  sleepImpl,
  nowFn,
  onCall,
  maxConcurrency = 3,
  maxRetries = 2,
  timeoutMs = 10000,
} = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const sleep = sleepImpl || (ms => new Promise(r => setTimeout(r, ms)));
  const now = nowFn || Date.now;
  const reportCall = typeof onCall === 'function' ? onCall : () => {}; // monitor de cota (story quota-monitor)

  // --- Semáforo de concorrência ---
  let active = 0;
  const waiters = [];
  function acquire() {
    if (active < maxConcurrency) { active++; return Promise.resolve(); }
    return new Promise(resolve => waiters.push(resolve));
  }
  function release() {
    const next = waiters.shift();
    if (next) next();   // passa o slot adiante (active permanece)
    else active--;      // libera o slot
  }

  const metrics = { hits: 0, misses: 0, retries: 0 };

  async function fetchTrinks(path, { retries = maxRetries } = {}) {
    const url = `${baseUrl}${path}`;
    for (let attempt = 0; ; attempt++) {
      await acquire();
      let res;
      try {
        try { reportCall(); } catch (_) {} // conta a chamada (cada tentativa consome cota Trinks, inclusive 429)
        res = await doFetch(url, {
          headers: { 'X-Api-Key': apiKey, 'estabelecimentoId': estId },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } finally {
        release(); // libera o slot ANTES do backoff (não segura a fila durante o sleep)
      }
      if (res.status === 429 && attempt < retries) {
        const ra = parseInt(res.headers?.get?.('retry-after') || '0', 10);
        const wait = ra > 0 ? ra * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
        metrics.retries++;
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`Trinks ${res.status}: ${url}`);
      return res.json();
    }
  }

  // --- Cache TTL + in-flight dedup por path. Não cacheia erro (caller degrada como hoje). ---
  const cache = new Map();    // path -> { value, expiresAt }
  const inflight = new Map(); // path -> Promise
  async function cachedFetchTrinks(path, ttlMs) {
    const hit = cache.get(path);
    if (hit && now() < hit.expiresAt) { metrics.hits++; return hit.value; }
    if (inflight.has(path)) return inflight.get(path); // coalesce concorrentes
    metrics.misses++;
    const p = (async () => {
      const value = await fetchTrinks(path);
      cache.set(path, { value, expiresAt: now() + ttlMs });
      return value;
    })();
    inflight.set(path, p);
    try { return await p; }
    finally { inflight.delete(path); }
  }

  function invalidate(path) { cache.delete(path); }
  function slotsCacheKey(date) { return `/agendamentos/profissionais/${date}`; }

  return {
    fetchTrinks,
    cachedFetchTrinks,
    invalidate,
    slotsCacheKey,
    metrics,
    _state: { get active() { return active; }, get cachedKeys() { return cache.size; } },
  };
}

module.exports = { createTrinksCache };
