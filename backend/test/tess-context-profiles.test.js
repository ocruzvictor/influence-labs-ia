/**
 * Testes — tess-context-profiles + assembler fetch specs (S2).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildContextProfile, PROFILES } = require('../lib/tess-context-profiles');
const { INTENTS } = require('../lib/tess-context-intent');
const { resolveSlotDates } = require('../lib/tess-context-assembler');
const { parseTessContextConfig } = require('../lib/tess-context-config');
const { measureContextBlocks, approxTokens } = require('../lib/tess-context-bytes');

describe('buildContextProfile', () => {
  test('mode=full → always FULL', () => {
    const p = buildContextProfile(
      { intent: INTENTS.TRIVIAL, confidence: 'high' },
      { effectiveMode: 'full', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.FULL);
    assert.equal(p.fetchSlots, true);
    assert.equal(p.fetchCatalog, true);
  });

  test('mode=full + CANCEL high → CANCEL enxuto', () => {
    const p = buildContextProfile(
      { intent: INTENTS.CANCEL, confidence: 'high' },
      { effectiveMode: 'full', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.CANCEL);
    assert.equal(p.fetchSlots, false);
    assert.equal(p.fetchCatalog, false);
    assert.equal(p.fetchProfessionals, false);
    assert.equal(p.fetchFutureBookings, true);
  });

  test('scoped TRIVIAL → MIN zero fetch', () => {
    const p = buildContextProfile(
      { intent: INTENTS.TRIVIAL, confidence: 'high' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.MIN);
    assert.equal(p.fetchSlots, false);
    assert.equal(p.fetchCatalog, false);
    assert.equal(p.fetchProfessionals, false);
  });

  test('scoped PRICE → no slots', () => {
    const p = buildContextProfile(
      { intent: INTENTS.PRICING, confidence: 'high' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.PRICE);
    assert.equal(p.fetchSlots, false);
    assert.equal(p.fetchCatalog, true);
  });

  test('scoped BOOKING explicit date → 1 slot day', () => {
    const p = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'high' },
      { effectiveMode: 'scoped', slotContextDays: 10, requestedDate: '2026-09-05' },
    );
    assert.equal(p.profile, PROFILES.BOOKING);
    assert.equal(p.slotDays, 1);
    assert.equal(p.explicitDateOnly, true);
  });

  test('UNCERTAIN → MIN (não herda FULL)', () => {
    const p = buildContextProfile(
      { intent: INTENTS.UNCERTAIN, confidence: 'low' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.MIN);
    assert.equal(p.fetchSlots, false);
    assert.equal(p.fetchCatalog, false);
  });

  test('UNCERTAIN em mode=full também fica MIN', () => {
    const p = buildContextProfile(
      { intent: INTENTS.UNCERTAIN, confidence: 'low' },
      { effectiveMode: 'full', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.MIN);
  });

  test('scoped CANCEL → fetchSlots false, future bookings only', () => {
    const p = buildContextProfile(
      { intent: INTENTS.CANCEL, confidence: 'high' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.CANCEL);
    assert.equal(p.fetchSlots, false);
    assert.equal(p.fetchFutureBookings, true);
  });

  test('low confidence + scoped → perfil do intent (não FULL)', () => {
    const p = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'medium' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.BOOKING);
  });

  test('story 6: SCHEDULING high pós-failed → BOOKING (não FULL 29k)', () => {
    const p = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['post_failed', 'continuation'] },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    assert.equal(p.profile, PROFILES.BOOKING);
    assert.equal(p.slotDays, 3);
    assert.notEqual(p.profile, PROFILES.FULL);
  });
});

describe('resolveSlotDates', () => {
  const getNextBusinessDays = (n) => ['2026-09-02', '2026-09-03', '2026-09-04'].slice(0, n);
  const mergeSlotContextDates = (a, b) => [...new Set([...a, ...b])].sort();
  const nextSaturdayDates = () => ['2026-09-06'];

  test('FULL profile → multi-day + saturdays', () => {
    const spec = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'high' },
      { effectiveMode: 'full', slotContextDays: 3 },
    );
    const dates = resolveSlotDates({
      profileSpec: spec,
      getNextBusinessDays,
      mergeSlotContextDates,
      nextSaturdayDates,
      slotContextDays: 3,
      requestedDate: null,
    });
    assert.ok(dates.length >= 3);
    assert.ok(dates.includes('2026-09-06'));
  });

  test('BOOKING scoped → max 3 days without explicit date', () => {
    const spec = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'high' },
      { effectiveMode: 'scoped', slotContextDays: 10 },
    );
    const dates = resolveSlotDates({
      profileSpec: spec,
      getNextBusinessDays: (n) => Array.from({ length: n }, (_, i) => `2026-09-0${i + 2}`),
      mergeSlotContextDates,
      nextSaturdayDates: () => [],
      slotContextDays: 10,
      requestedDate: null,
    });
    assert.ok(dates.length <= 4);
  });
});

describe('parseTessContextConfig', () => {
  test('defaults scoped (Victor 2026-09-03)', () => {
    const c = parseTessContextConfig({});
    assert.equal(c.mode, 'scoped');
    assert.equal(c.effectiveMode, 'scoped');
    assert.equal(c.skipTrivial, false);
    assert.equal(c.trivialMaxChars, 80);
  });

  test('invalid mode → scoped', () => {
    const c = parseTessContextConfig({ TESS_CONTEXT_MODE: 'bogus' });
    assert.equal(c.mode, 'scoped');
  });

  test('FORCE_FULL overrides scoped', () => {
    const c = parseTessContextConfig({ TESS_CONTEXT_MODE: 'scoped', TESS_CONTEXT_FORCE_FULL: '1' });
    assert.equal(c.effectiveMode, 'full');
  });
});

describe('measureContextBytes — oi vs booking fixture', () => {
  test('MIN shell much smaller than FULL payload', () => {
    const minBlocks = measureContextBlocks({
      shell: 'CONTEXTO...\nHOJE: 01/09/2026\nNOTAS OPERACIONAIS',
      horarios: '',
      servicos: '',
      habilitacao: '',
      profissionais: '',
      historico: '',
      future_bookings: '',
      user_payload: 'CONTEXTO...\n\nMENSAGEM DO CLIENTE: oi',
    });
    const fullBlocks = measureContextBlocks({
      shell: 'CONTEXTO...\nHOJE: 01/09/2026\nNOTAS OPERACIONAIS\nDATAS COM DADOS',
      horarios: 'HORARIOS VAGOS '.repeat(200),
      servicos: 'SERVICOS DISPONIVEIS\n'.repeat(120),
      habilitacao: 'HABILITACAO\n'.repeat(80),
      profissionais: 'PROFISSIONAIS ATIVOS\n'.repeat(12),
      historico: '',
      future_bookings: '',
      user_payload: 'FULL PAYLOAD'.repeat(500),
    });
    assert.ok(minBlocks.total.chars < fullBlocks.total.chars / 5);
    assert.ok(minBlocks.horarios.chars === 0);
    assert.ok(fullBlocks.horarios.chars > 1000);
    assert.equal(approxTokens(100), 25);
  });
});
