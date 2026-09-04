/**
 * Contratos P-BUDGET — SOT §8.1–8.6
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CAPS,
  BUDGET_KEYS,
  parseContextCaps,
  resolveCap,
  measureBudgetChars,
  applyContextBudget,
} = require('../lib/tess-context-budget');
const { PROFILES } = require('../lib/tess-context-profiles');

function pad(n) {
  return 'x'.repeat(n);
}

function mockRebuildFactory(parts) {
  return (state) => {
    const shell = parts.shell || 'SHELL\nCONTEXTO DINAMICO\nNOTAS OPERACIONAIS\n';
    const horarios = state.slotDayTexts.join('\n');
    const servicos = state.svcPayload.text || '';
    const hab = state.habilitacaoText || '';
    const profs = state.profsPayload.text || '';
    const hist = (state.historyForModel || [])
      .map((m) => m.content)
      .join('\n');
    const fb = (state.futureBookings || []).length
      ? JSON.stringify(state.futureBookings)
      : '';
    const datesLine = state.slotDates.length
      ? `DATAS COM DADOS DISPONIVEIS: ${state.slotDates.join(', ')}`
      : '';
    const dynamicContext = [
      shell,
      datesLine,
      horarios,
      servicos,
      hab,
      profs,
      fb,
      hist,
    ].filter(Boolean).join('\n');
    const blocks = {
      shell,
      horarios,
      servicos,
      habilitacao: hab,
      profissionais: profs,
      historico: hist,
      future_bookings: fb,
      user_payload: dynamicContext + '\n\nMENSAGEM DO CLIENTE: msg',
    };
    return { dynamicContext, blocks };
  };
}

describe('parseContextCaps / resolveCap', () => {
  test('env override 12000 vs 0/abc → 16000 default', () => {
    const caps = parseContextCaps({
      TESS_CONTEXT_CAP_BOOKING: '12000',
      TESS_CONTEXT_CAP_FULL: '0',
      TESS_CONTEXT_CAP_MIN: 'abc',
    });
    assert.equal(caps.BOOKING, 12000);
    assert.equal(caps.FULL, DEFAULT_CAPS.FULL);
    assert.equal(caps.MIN, DEFAULT_CAPS.MIN);
    assert.equal(resolveCap('BOOKING', caps), 12000);
  });

  test('unknown profile → FULL cap', () => {
    assert.equal(resolveCap('UNKNOWN', DEFAULT_CAPS), DEFAULT_CAPS.FULL);
  });
});

describe('measureBudgetChars', () => {
  test('8.5 user_payload não entra na soma', () => {
    const blocks = {
      shell: pad(500),
      horarios: '',
      servicos: pad(700),
      habilitacao: '',
      profissionais: '',
      historico: pad(800),
      future_bookings: '',
      user_payload: pad(90000),
    };
    assert.equal(measureBudgetChars(blocks), 2000);
    assert.equal(measureBudgetChars(blocks, pad(2000)), 2000);
    assert.ok(!BUDGET_KEYS.includes('user_payload'));
  });
});

describe('applyContextBudget', () => {
  test('8.1 BOOKING sob o teto — no-op', () => {
    const dynamicContext = pad(10742);
    const slotDates = ['2026-09-02', '2026-09-03'];
    const result = applyContextBudget({
      profile: PROFILES.BOOKING,
      dynamicContext,
      blocks: { shell: pad(1000), horarios: pad(9000), servicos: pad(742) },
      slotDates,
      slotDayTexts: ['day1', 'day2'],
      caps: DEFAULT_CAPS,
      rebuild: mockRebuildFactory({ shell: pad(1000) }),
    });
    assert.equal(result.trimMeta.trimmed, false);
    assert.deepEqual(result.trimMeta.steps_applied, []);
    assert.equal(result.dynamicContext, dynamicContext);
    assert.deepEqual(result.slotDates, slotDates);
  });

  test('8.2 HORARIOS gordo — drop_slot_days pin requestedDate', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const fatDay = pad(5000);
    const slotDayTexts = dates.map((d) => `${d}\n${fatDay}`);
    const rebuild = mockRebuildFactory({ shell: 'SHELL\n' });
    const result = applyContextBudget({
      profile: PROFILES.BOOKING,
      dynamicContext: pad(30000),
      blocks: { shell: 'S', horarios: slotDayTexts.join('\n') },
      slotDates: [...dates],
      slotDayTexts: [...slotDayTexts],
      requestedDate: '2026-09-03',
      todayIso: '2026-09-02',
      caps: DEFAULT_CAPS,
      rebuild,
    });
    assert.ok(result.trimMeta.trimmed);
    assert.ok(result.trimMeta.steps_applied.includes('drop_slot_days'));
    assert.ok(result.trimMeta.days_after < result.trimMeta.days_before);
    assert.ok(result.slotDates.includes('2026-09-03'));
    assert.ok(result.blocks.horarios.length > 0);
    assert.ok(result.trimMeta.after_chars <= DEFAULT_CAPS.BOOKING);
  });

  test('8.3 FULL ~90k — termina ≤24000 com prefixos protegidos', () => {
    const shell = 'CONTEXTO DINAMICO - TRINKS\nNOTAS OPERACIONAIS (vale mesmo se a KB TESS estiver desatualizada):\n';
    const rebuild = mockRebuildFactory({ shell });
    const svcData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      nome: `Servico ${i}`,
      profissionais: ['Erick'],
      preco: 100,
    }));
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const result = applyContextBudget({
      profile: PROFILES.FULL,
      dynamicContext: pad(90000),
      blocks: {},
      slotDates: dates,
      slotDayTexts: dates.map(() => pad(12000)),
      svcPayload: {
        text: pad(15000),
        data: svcData,
      },
      habilitacaoText: pad(5000),
      historyForModel: Array.from({ length: 8 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: pad(2000),
      })),
      caps: DEFAULT_CAPS,
      messageText: 'quero agendar',
      rebuild,
    });
    assert.ok(result.trimMeta.trimmed);
    assert.ok(result.trimMeta.steps_applied.length >= 1);
    assert.ok(result.trimMeta.after_chars <= DEFAULT_CAPS.FULL);
    assert.match(result.dynamicContext, /CONTEXTO DINAMICO/);
    assert.match(result.dynamicContext, /NOTAS OPERACIONAIS/);
  });

  test('8.4 MIN já sob o teto — no-op', () => {
    const dynamicContext = pad(6124);
    const result = applyContextBudget({
      profile: PROFILES.MIN,
      dynamicContext,
      blocks: {
        shell: pad(1000),
        historico: pad(5124),
        horarios: '',
        servicos: '',
        habilitacao: '',
        profissionais: '',
        future_bookings: '',
      },
      slotDates: [],
      slotDayTexts: [],
      historyForModel: [{ role: 'user', content: pad(5124) }],
      caps: DEFAULT_CAPS,
      rebuild: mockRebuildFactory({ shell: pad(1000) }),
    });
    assert.equal(result.trimMeta.trimmed, false);
    assert.equal(result.slotDates.length, 0);
  });

  test('8.5 applyContextBudget ignora user_payload gordo', () => {
    const dynamicContext = pad(2000);
    const result = applyContextBudget({
      profile: PROFILES.MIN,
      dynamicContext,
      blocks: {
        shell: pad(2000),
        user_payload: pad(90000),
      },
      caps: DEFAULT_CAPS,
      rebuild: () => ({ dynamicContext, blocks: { shell: pad(2000) } }),
    });
    assert.equal(result.trimMeta.trimmed, false);
  });

  test('8.6 CANCEL lean ~6000 — no-op', () => {
    const dynamicContext = pad(6000);
    const result = applyContextBudget({
      profile: PROFILES.CANCEL,
      dynamicContext,
      blocks: { shell: pad(6000) },
      futureBookings: [{ trinks_id: '1', scheduled_at: '2026-09-10T10:00:00Z' }],
      caps: DEFAULT_CAPS,
      rebuild: mockRebuildFactory({ shell: pad(6000) }),
    });
    assert.equal(result.trimMeta.trimmed, false);
  });

  test('8.6 CANCEL fat — ≥1 future booking permanece', () => {
    const bookings = Array.from({ length: 5 }, (_, i) => ({
      trinks_id: String(i + 1),
      scheduled_at: `2026-09-${10 + i}T10:00:00Z`,
      service_name: `Svc ${i}`,
    }));
    const rebuild = mockRebuildFactory({ shell: pad(500) });
    const result = applyContextBudget({
      profile: PROFILES.CANCEL,
      dynamicContext: pad(25000),
      blocks: {},
      futureBookings: bookings,
      historyForModel: Array.from({ length: 8 }, (_, i) => ({
        role: 'user',
        content: pad(2500),
      })),
      caps: DEFAULT_CAPS,
      rebuild,
    });
    assert.ok(result.trimMeta.trimmed);
    assert.ok(
      result.trimMeta.steps_applied.includes('shorten_history')
      || result.trimMeta.steps_applied.includes('truncate_future_bookings'),
    );
    assert.ok(result.futureBookings.length >= 1);
  });

  test('8.6 PRICE catálogo 20k — filter_catalog e servicos não vazio', () => {
    const svcData = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      nome: `ServicoLongoNome${i}${pad(200)}`,
      profissionais: ['Erick'],
      preco: 100 + i,
    }));
    const formatted = require('../lib/booking-parser').formatServicesText(svcData);
    const svcText = formatted.text;
    assert.ok(svcText.length > 15000, `fixture should be fat, got ${svcText.length}`);
    const rebuild = mockRebuildFactory({ shell: pad(500) });
    const result = applyContextBudget({
      profile: PROFILES.PRICE,
      dynamicContext: svcText + pad(500),
      blocks: { servicos: svcText },
      svcPayload: { text: svcText, data: svcData },
      messageText: 'oi',
      caps: DEFAULT_CAPS,
      rebuild,
    });
    assert.ok(result.trimMeta.trimmed);
    assert.ok(result.trimMeta.steps_applied.includes('filter_catalog'));
    assert.ok(result.trimMeta.after_chars <= DEFAULT_CAPS.PRICE);
    assert.ok(result.blocks.servicos.length > 0);
  });

  test('8.6 rebuild — DATAS COM DADOS DISPONIVEIS só datas restantes', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
    const rebuild = mockRebuildFactory({ shell: 'SHELL\n' });
    const result = applyContextBudget({
      profile: PROFILES.BOOKING,
      dynamicContext: pad(30000),
      blocks: {},
      slotDates: [...dates],
      slotDayTexts: dates.map((d) => `${d}\n${pad(8000)}`),
      requestedDate: '2026-09-02',
      todayIso: '2026-09-02',
      caps: DEFAULT_CAPS,
      rebuild,
    });
    assert.ok(result.trimMeta.trimmed);
    for (const d of result.slotDates) {
      assert.match(result.dynamicContext, new RegExp(d));
    }
    const removed = dates.filter((d) => !result.slotDates.includes(d));
    for (const d of removed) {
      assert.doesNotMatch(result.dynamicContext, new RegExp(`DATAS COM DADOS DISPONIVEIS:[^\\n]*${d}`));
    }
  });
});
