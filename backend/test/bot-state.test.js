/**
 * Testes unitários para backend/lib/bot-state.js.
 *
 * Executa com Node test runner nativo (Node 18+):
 *   cd backend && npm test
 *   ou: node --test test/bot-state.test.js
 *
 * Estratégia: mockar backend/db.js via require.cache antes de carregar bot-state.
 */

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const dbPath = require.resolve('../db');
const botStatePath = require.resolve('../lib/bot-state');

let mockQueries = [];
let queryCallCount = 0;

function setupMockDb({ togglesRows, whitelistRows, returnNull = false }) {
  queryCallCount = 0;
  mockQueries = [];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql) => {
        queryCallCount++;
        mockQueries.push(sql);
        if (returnNull) return null;
        if (sql.includes('bot_toggles')) {
          return { rows: togglesRows };
        }
        if (sql.includes('bot_whitelist')) {
          return { rows: whitelistRows };
        }
        return { rows: [] };
      },
    },
  };
  // Limpa bot-state pra re-importar com mock
  delete require.cache[botStatePath];
}

function teardown() {
  delete require.cache[dbPath];
  delete require.cache[botStatePath];
}

afterEach(teardown);

test('1. getBotState retorna toggles e whitelist em formato esperado', async () => {
  setupMockDb({
    togglesRows: [
      { key: 'global', enabled: true },
      { key: 'feature:audio', enabled: false },
    ],
    whitelistRows: [
      { phone: '5511964540007', mode: 'allow' },
      { phone: '5511999999999', mode: 'block' },
    ],
  });
  const { getBotState } = require('../lib/bot-state');

  const state = await getBotState();
  assert.equal(state.toggles.global, true);
  assert.equal(state.toggles['feature:audio'], false);
  assert.equal(state.whitelist.get('5511964540007'), 'allow');
  assert.equal(state.whitelist.get('5511999999999'), 'block');
  assert.equal(state.whitelist.size, 2);
});

test('2. Cache hit: chamadas subsequentes dentro do TTL não tocam DB', async () => {
  setupMockDb({ togglesRows: [], whitelistRows: [] });
  const { getBotState } = require('../lib/bot-state');

  await getBotState();
  const callsAfterFirst = queryCallCount;
  await getBotState();
  await getBotState();
  assert.equal(queryCallCount, callsAfterFirst, 'cache deveria absorver as 2 chamadas seguintes');
});

test('3. Cache miss: após invalidateCache, próxima chamada refaz queries', async () => {
  setupMockDb({ togglesRows: [], whitelistRows: [] });
  const { getBotState, invalidateCache } = require('../lib/bot-state');

  await getBotState();
  const callsBefore = queryCallCount;
  invalidateCache();
  await getBotState();
  assert.equal(queryCallCount, callsBefore + 2, 'deveria fazer 2 queries novas (toggles + whitelist)');
});

test('4. Fail-safe: db.query retorna null → getBotState retorna { toggles:null, whitelist:null }', async () => {
  setupMockDb({ togglesRows: [], whitelistRows: [], returnNull: true });
  const { getBotState } = require('../lib/bot-state');

  const state = await getBotState();
  assert.equal(state.toggles, null);
  assert.equal(state.whitelist, null);
});

test('5. Whitelist vazia (DB OK, sem rows) — caller usa para fallback', async () => {
  setupMockDb({
    togglesRows: [{ key: 'global', enabled: true }],
    whitelistRows: [], // <- vazia
  });
  const { getBotState } = require('../lib/bot-state');

  const state = await getBotState();
  assert.equal(state.whitelist.size, 0, 'Map vazio sinaliza fallback ao env legacy');
  assert.equal(state.toggles.global, true);
});

test('6. Resultado nulo NÃO é cacheado (próxima chamada tenta DB de novo)', async () => {
  setupMockDb({ togglesRows: [], whitelistRows: [], returnNull: true });
  const { getBotState } = require('../lib/bot-state');

  await getBotState();
  const callsAfterFirst = queryCallCount;
  await getBotState();
  assert.ok(
    queryCallCount > callsAfterFirst,
    'segunda chamada após null deveria tentar DB de novo (não cacheia fail-safe)'
  );
});

test('7. CACHE_TTL_MS exportado igual a 5000ms', () => {
  setupMockDb({ togglesRows: [], whitelistRows: [] });
  const { CACHE_TTL_MS } = require('../lib/bot-state');
  assert.equal(CACHE_TTL_MS, 5_000);
});
