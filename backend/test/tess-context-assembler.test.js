/**
 * Testes — assembler lazy fetch (mock Trinks deps).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { assembleTessContext } = require('../lib/tess-context-assembler');
const { INTENTS } = require('../lib/tess-context-intent');
const { parseTessContextConfig } = require('../lib/tess-context-config');

function mockDeps(overrides = {}) {
  const calls = { slots: 0, catalog: 0, profs: 0, future: 0, snapshot: 0 };
  return {
    calls,
    sessionId: 'test-session',
    messageText: overrides.messageText || 'oi',
    phone: overrides.phone || null,
    intentResult: overrides.intentResult || { intent: INTENTS.TRIVIAL, confidence: 'high', signals: [] },
    config: overrides.config || parseTessContextConfig({ TESS_CONTEXT_MODE: 'scoped' }),
    slotContextDays: 10,
    requestedDate: overrides.requestedDate || null,
    historyForModel: [],
    persistedForModel: null,
    trinksCanonicalName: null,
    buildDynamicContext: (...args) => {
      const [days, slots, profs, , svcs, , , hab] = args;
      return [
        'SHELL',
        days.length ? `DATAS:${days.join(',')}` : '',
        slots,
        profs,
        svcs,
        hab,
      ].filter(Boolean).join('\n');
    },
    getSlots: async () => {
      calls.slots++;
      return 'HORARIOS VAGOS 2026-09-02:\n- Erick: 10:00';
    },
    getProfessionals: async () => {
      calls.profs++;
      return { text: 'PROFISSIONAIS ATIVOS:\n- Erick', data: [{ id: 1, nome: 'Erick' }] };
    },
    getServicesText: async () => {
      calls.catalog++;
      return {
        text: 'SERVICOS DISPONIVEIS:\n- Corte (ID 1)',
        data: [{ id: 1, nome: 'Corte Masculino', profissionais: ['Erick'], preco: 85 }],
      };
    },
    loadClientFutureBookings: async () => {
      calls.future++;
      return [];
    },
    ensureSlotSnapshot: async () => {
      calls.snapshot++;
    },
    getNextBusinessDays: (n) => Array.from({ length: n }, (_, i) => `2026-09-0${i + 2}`),
    mergeSlotContextDates: (a, b) => [...new Set([...a, ...b])].sort(),
    nextSaturdayDates: () => ['2026-09-06'],
    ...overrides,
  };
}

describe('assembleTessContext', () => {
  test('scoped MIN → zero slot/catalog fetch', async () => {
    const deps = mockDeps();
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'MIN');
    assert.equal(deps.calls.slots, 0);
    assert.equal(deps.calls.catalog, 0);
    assert.equal(deps.calls.profs, 0);
    assert.ok(result.dynamicContext.includes('SHELL'));
    assert.ok(!result.dynamicContext.includes('HORARIOS VAGOS'));
  });

  test('mode=full → fetches slots + catalog + profs', async () => {
    const deps = mockDeps({
      messageText: 'quero cortar',
      intentResult: { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: [] },
      config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'FULL');
    assert.ok(deps.calls.slots >= 3);
    assert.equal(deps.calls.catalog, 1);
    assert.equal(deps.calls.profs, 1);
  });

  test('scoped PRICE → catalog only, no slots', async () => {
    const deps = mockDeps({
      messageText: 'quanto custa o corte?',
      intentResult: { intent: INTENTS.PRICING, confidence: 'high', signals: ['price'] },
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'PRICE');
    assert.equal(deps.calls.slots, 0);
    assert.equal(deps.calls.catalog, 1);
    assert.equal(deps.calls.profs, 0);
  });

  test('scoped BOOKING → limited slot days', async () => {
    const deps = mockDeps({
      messageText: 'quero cortar amanhã',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-03',
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'BOOKING');
    assert.equal(deps.calls.slots, 1);
    assert.equal(deps.calls.snapshot, 1);
    assert.ok(result.slotDates.includes('2026-09-03'));
  });

  test('FULL + requestedDate fora da janela → ensureSlotSnapshot antes do getSlots', async () => {
    const deps = mockDeps({
      messageText: 'quero dia 2026-10-15',
      intentResult: { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: [] },
      config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
      requestedDate: '2026-10-15',
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'FULL');
    assert.equal(deps.calls.snapshot, 1);
    assert.ok(result.slotDates.includes('2026-10-15'));
  });
});
