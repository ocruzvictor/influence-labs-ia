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
    getSlotsGrouped: async () => ({
      label: '02/09 (terça)',
      date: '2026-09-02',
      professionals: [
        {
          name: 'Erick',
          professionalId: '1',
          startsAt: [
            '2026-09-02T09:00:00-03:00',
            '2026-09-02T14:00:00-03:00',
            '2026-09-02T15:00:00-03:00',
          ],
        },
      ],
    }),
    getProfessionals: async () => {
      calls.profs++;
      return { text: 'PROFISSIONAIS ATIVOS:\n- Erick', data: [{ id: 1, nome: 'Erick' }] };
    },
    getServicesText: async () => {
      calls.catalog++;
      const data = overrides.catalogData || [
        { id: 1, nome: 'Corte Masculino', profissionais: ['Erick'], preco: 85 },
      ];
      return {
        text: `SERVICOS DISPONIVEIS:\n${data.map((s) => `- ${s.nome}`).join('\n')}`,
        data,
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
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
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
    assert.equal(deps.calls.slots, 0);
    assert.equal(deps.calls.snapshot, 2);
    assert.ok(result.slotDates.includes('2026-09-03'));
    assert.ok(result.slotDates.includes('2026-09-02'));
    assert.match(result.blocks.horarios, /OFERTA CONSULTIVA/);
    assert.ok(result.blocks.horarios.length < 1200);
  });

  test('scoped BOOKING de tarde → compact occupancy sem relógios', async () => {
    const deps = mockDeps({
      messageText: 'de tarde',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-03',
    });
    const result = await assembleTessContext(deps);
    assert.match(result.blocks.horarios, /período tarde/);
    assert.doesNotMatch(result.blocks.horarios, /\d{2}:\d{2} \(\d+min contínuos\)/);
  });

  test('mode=full BOOKING → fat dump via getSlots (não compact)', async () => {
    const fat = 'HORARIOS VAGOS 2026-09-02:\n- Erick: ' + '10:00, '.repeat(80);
    const deps = mockDeps({
      messageText: 'quero cortar amanhã',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
      getSlots: async () => {
        deps.calls.slots++;
        return fat;
      },
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'FULL');
    assert.ok(deps.calls.slots >= 1);
    assert.doesNotMatch(result.blocks.horarios, /OFERTA CONSULTIVA/);
    assert.ok(result.blocks.horarios.length > 500);
  });

  test('FULL + requestedDate fora da janela → ensureSlotSnapshot antes do getSlots', async () => {
    const deps = mockDeps({
      messageText: 'quero dia 2026-10-15',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
      requestedDate: '2026-10-15',
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'FULL');
    assert.equal(deps.calls.snapshot, 2);
    assert.ok(result.slotDates.includes('2026-10-15'));
    assert.ok(result.slotDates.includes('2026-09-02'));
  });

  test('scoped PRICE usa histórico para filtrar catálogo (R1.2 mais em conta)', async () => {
    const deps = mockDeps({
      messageText: 'tem profissional mais em conta?',
      intentResult: { intent: INTENTS.PRICING, confidence: 'high', signals: ['price'] },
      historyForModel: [
        { role: 'user', content: 'quanto custa pra cortar com o Tiago?' },
        { role: 'assistant', content: 'Corte com o Tiago é R$250.' },
      ],
      catalogData: [
        { id: 1, nome: 'Corte Masculino', profissionais: ['Erick'], preco: 85 },
        { id: 2, nome: 'Manicure', profissionais: ['Dylan'], preco: 50 },
      ],
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'PRICE');
    assert.match(result.dynamicContext, /Corte Masculino/);
    assert.doesNotMatch(result.dynamicContext, /Manicure/);
  });

  test('scoped UNCERTAIN → MIN sem fetch de grade', async () => {
    const deps = mockDeps({
      messageText: 'quanto custa e tem sábado?',
      intentResult: { intent: INTENTS.UNCERTAIN, confidence: 'low', signals: ['multi'] },
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'MIN');
    assert.equal(deps.calls.slots, 0);
    assert.equal(deps.calls.catalog, 0);
    assert.ok(!result.dynamicContext.includes('HORARIOS VAGOS'));
  });

  test('scoped BOOKING passa durationMin e filtra buraco curto', async () => {
    const deps = mockDeps({
      messageText: 'de tarde com o Erick',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-02',
      catalogData: [
        { id: 1, nome: 'Maquiagem', profissionais: ['Erick'], duracaoEmMinutos: 120 },
      ],
      getSlotsGrouped: async () => ({
        label: '02/09 (terça)',
        date: '2026-09-02',
        snapshotAgeMin: 10,
        professionals: [{
          name: 'Erick',
          professionalId: '1',
          startsAt: ['2026-09-02T14:00:00-03:00', '2026-09-02T14:30:00-03:00'],
        }],
      }),
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'BOOKING');
    assert.match(result.blocks.horarios, /sem janela contínua de 120min/);
    assert.doesNotMatch(result.blocks.horarios, /14:00 \(30min/);
  });

  test('scoped BOOKING durationMin ignora corte no histórico se a fala é maquiagem', async () => {
    const deps = mockDeps({
      messageText: 'quero maquiagem com a Fefe no sábado',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-05',
      historyForModel: [
        { role: 'user', content: 'quanto custa o corte e tem horário sábado?' },
        { role: 'assistant', content: 'Corte Masculino é R$ 90.' },
      ],
      catalogData: [
        { id: 1, nome: 'Corte Masculino', profissionais: ['André'], duracaoEmMinutos: 60 },
        { id: 2, nome: 'TA - Corte Masculino', profissionais: ['André'], duracaoEmMinutos: 60 },
        { id: 3, nome: 'Corte Feminino', profissionais: ['Giovanna'], duracaoEmMinutos: 120 },
        { id: 4, nome: 'Maquiagem', profissionais: ['Fefe'], duracaoEmMinutos: 120 },
      ],
      getSlotsGrouped: async () => ({
        label: '05/09 (sábado)',
        date: '2026-09-05',
        snapshotAgeMin: 10,
        professionals: [{
          name: 'Fefe',
          professionalId: '826936',
          startsAt: ['2026-09-05T12:30:00-03:00'],
        }],
      }),
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'BOOKING');
    assert.match(result.blocks.horarios, /sem janela contínua de 120min/);
    assert.doesNotMatch(result.blocks.horarios, /12:30/);
  });

  test('scoped BOOKING penteado dia a dia anota DISAMBIGUA e inclui corte', async () => {
    const deps = mockDeps({
      messageText: 'Penteado para o dia a dia',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-04',
      catalogData: [
        { id: 1, nome: 'Penteado', profissionais: ['Giovanna'], duracaoEmMinutos: 60 },
        { id: 2, nome: 'Corte Masculino', profissionais: ['André'], duracaoEmMinutos: 60 },
      ],
    });
    const result = await assembleTessContext(deps);
    assert.match(result.dynamicContext, /DISAMBIGUA/);
    assert.match(result.dynamicContext, /Corte Masculino/);
    assert.match(result.dynamicContext, /Penteado/);
  });

  test('snapshot velho anota o bloco HORARIOS', async () => {
    const deps = mockDeps({
      messageText: 'quero cortar amanhã',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-02',
      getSlotsGrouped: async () => ({
        label: '02/09 (terça)',
        date: '2026-09-02',
        snapshotAgeMin: 90,
        professionals: [{
          name: 'Erick',
          professionalId: '1',
          startsAt: ['2026-09-02T09:00:00-03:00', '2026-09-02T14:00:00-03:00'],
        }],
      }),
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.snapshotStale, true);
    assert.match(result.blocks.horarios, /SNAPSHOT: atualizado há 90 min/);
  });

  test('scoped BOOKING abaixo do teto — trimMeta sem corte', async () => {
    const deps = mockDeps({
      messageText: 'quero cortar amanhã',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      requestedDate: '2026-09-03',
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'BOOKING');
    assert.equal(result.trimMeta?.trimmed, false);
    assert.deepEqual(result.trimMeta?.steps_applied, []);
  });

  test('mode=full horarios gordo — budget reduz slotDates', async () => {
    const fat = 'HORARIOS VAGOS:\n' + '10:00 '.repeat(2800);
    const deps = mockDeps({
      messageText: 'quero cortar',
      intentResult: { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
      getSlots: async () => {
        deps.calls.slots++;
        return fat;
      },
      getNextBusinessDays: (n) => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`),
    });
    const result = await assembleTessContext(deps);
    assert.equal(result.contextProfile, 'FULL');
    assert.equal(result.trimMeta?.trimmed, true);
    assert.ok(result.trimMeta?.steps_applied.includes('drop_slot_days'));
    assert.ok(result.slotDates.length < 10);
    assert.ok(result.trimMeta.after_chars <= 24000);
  });

  test('G5 — genderQualifier masculino exclui Corte Feminino no catálogo', async () => {
    const { filterCatalogForProfile } = require('../lib/tess-context-assembler');
    const { buildContextProfile, PROFILES } = require('../lib/tess-context-profiles');
    const catalogData = [
      { id: 1, nome: 'Corte Masculino', profissionais: ['Erick'] },
      { id: 2, nome: 'Corte Feminino', profissionais: ['Jackie'] },
    ];
    const profileSpec = buildContextProfile(
      { intent: INTENTS.SCHEDULING, confidence: 'high', signals: ['booking'] },
      { effectiveMode: 'scoped', slotContextDays: 10, requestedDate: null },
    );
    assert.equal(profileSpec.profile, PROFILES.BOOKING);
    const filtered = filterCatalogForProfile(
      profileSpec,
      catalogData,
      'tem horario a tarde',
      [{ role: 'user', content: 'Masculino' }],
      'masculino',
    );
    assert.ok(filtered?.some((s) => s.nome === 'Corte Masculino'));
    assert.ok(!filtered?.some((s) => s.nome === 'Corte Feminino'));
  });
});
