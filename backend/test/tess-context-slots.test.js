/**
 * Testes — tess-context-slots (oferta consultiva).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectPeriod,
  detectExactClock,
  detectNamedProfessionals,
  classifySlotPeriod,
  compactBookingSlotsBlock,
  formatFullSlotsBlock,
  pickStartsForPeriod,
  extractSpeechDurationMin,
  resolveOfferDurationMin,
  skuDurationFrom,
  subtractOccupiedSlotStarts,
  shouldEmitSnapshotOffer,
  buildSnapshotOfferEventPayload,
  SNAPSHOT_STALE_OFFER_MIN,
} = require('../lib/tess-context-slots');

const ERICK_STARTS = [
  '2026-09-02T09:00:00-03:00',
  '2026-09-02T10:00:00-03:00',
  '2026-09-02T11:00:00-03:00',
  '2026-09-02T14:00:00-03:00',
  '2026-09-02T15:00:00-03:00',
  '2026-09-02T16:00:00-03:00',
  '2026-09-02T17:00:00-03:00',
  '2026-09-02T18:00:00-03:00',
];

describe('detectPeriod', () => {
  test('de tarde → afternoon', () => {
    assert.equal(detectPeriod('quero cortar de tarde'), 'afternoon');
  });

  test('amanhã sem período → null', () => {
    assert.equal(detectPeriod('quero cortar amanhã'), null);
  });

  test('16h → afternoon', () => {
    assert.equal(detectPeriod('prefiro 16h'), 'afternoon');
  });

  test('10h → morning', () => {
    assert.equal(detectPeriod('10h30 serve'), 'morning');
  });

  test('número de data sem marcador de hora → sem período', () => {
    assert.equal(detectPeriod('dia 10'), null);
  });
});

describe('compactBookingSlotsBlock', () => {
  const professionals = [
    { name: 'Erick', professionalId: '1', startsAt: ERICK_STARTS },
    { name: 'André', professionalId: '2', startsAt: ERICK_STARTS },
  ];

  test('sem período → occupancy-only, sem lista de relógios', () => {
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'quero cortar amanhã',
    });
    assert.match(text, /OFERTA CONSULTIVA/);
    assert.match(text, /há vagas de manhã e de tarde/);
    assert.doesNotMatch(text, /09:00/);
    assert.doesNotMatch(text, /16:00/);
    assert.ok(text.length < 500);
  });

  test('de tarde sem profissional → occupancy-only, zero relógios', () => {
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'de tarde',
      historyText: 'Assistente: há vagas de manhã e de tarde.',
      allowedProfessionalNames: ['Erick', 'André'],
    });
    assert.match(text, /período tarde/);
    assert.doesNotMatch(text, /\d{2}:\d{2} \(\d+min contínuos\)/);
    assert.match(text, /há vagas de tarde/);
    assert.ok(text.length < 800);
  });

  test('de tarde com profissional citado → no máximo 2 horários anotados', () => {
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'de tarde com o erick',
      allowedProfessionalNames: ['Erick', 'André'],
    });
    assert.match(text, /período tarde/);
    const timeMatches = text.match(/\d{2}:\d{2} \(\d+min contínuos\)/g) || [];
    assert.ok(timeMatches.length <= 2, `expected <=2 annotated times, got ${timeMatches.length}`);
    assert.doesNotMatch(text, /NÃO liste horários/);
  });

  test('profissional conhecido sem período → relógios reais, não occupancy consultiva', () => {
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'quais os horários disponíveis?',
      historyText: 'Cliente: quero cortar com o Erick no sábado.',
      allowedProfessionalNames: ['Erick', 'André'],
    });
    assert.match(text, /inícios reais Trinks/);
    assert.match(text, /\d{2}:\d{2} \(\d+min contínuos\)/);
    assert.doesNotMatch(text, /NÃO liste horários/);
    const timeMatches = text.match(/\d{2}:\d{2} \(\d+min contínuos\)/g) || [];
    assert.ok(timeMatches.length <= 2, `expected <=2 annotated times, got ${timeMatches.length}`);
  });

  test('snapshot velho prefixa aviso sem inventar horário', () => {
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'quero cortar amanhã',
      snapshotAgeMin: 90,
    });
    assert.match(text, /SNAPSHOT: atualizado há 90 min/);
    assert.match(text, /OFERTA CONSULTIVA/);
  });

  test('duração 90min filtra inícios que não cabem na janela contínua', () => {
    const tight = [
      { name: 'Erick', professionalId: '1', startsAt: [
        '2026-09-02T09:00:00-03:00',
        '2026-09-02T09:30:00-03:00',
        '2026-09-02T10:00:00-03:00',
        '2026-09-02T14:00:00-03:00',
      ] },
    ];
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals: tight,
      messageText: 'de tarde com o erick',
      durationMin: 90,
      allowedProfessionalNames: ['Erick'],
    });
    assert.doesNotMatch(text, /14:00/);
    assert.match(text, /09:00 \(90min contínuos\)/);
  });

  test('habilitacao — Dylan excluído para corte', () => {
    const allProfs = [
      { name: 'Erick', professionalId: '1', startsAt: ERICK_STARTS },
      { name: 'André', professionalId: '2', startsAt: ERICK_STARTS },
      { name: 'Dylan', professionalId: '3', startsAt: ERICK_STARTS },
    ];
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals: allProfs,
      messageText: 'de tarde',
      allowedProfessionalNames: ['Erick', 'André'],
    });
    assert.doesNotMatch(text, /Dylan/);
    assert.match(text, /Erick/);
  });

  test('tarde após bot citar manhã e tarde → detectPeriod afternoon na msg atual', () => {
    assert.equal(detectPeriod('tarde'), 'afternoon');
    const text = compactBookingSlotsBlock({
      label: '02/09 (terça)',
      professionals,
      messageText: 'tarde',
      historyText: 'Assistente: há vagas de manhã e de tarde.',
      allowedProfessionalNames: ['Erick', 'André'],
    });
    assert.match(text, /período tarde/);
    assert.doesNotMatch(text, /\d{2}:\d{2} \(\d+min contínuos\)/);
  });

  test('16:00 explícito incluído no cap da tarde', () => {
    const picked = pickStartsForPeriod(ERICK_STARTS, 'afternoon', 2, { hour: 16, minute: 0 });
    assert.equal(picked.length, 2);
    const has16 = picked.some((s) => s.includes('T16:00'));
    assert.ok(has16, '16:00 should be included when requested');
  });
});

describe('formatFullSlotsBlock', () => {
  test('full dump inclui todos os horários anotados', () => {
    const text = formatFullSlotsBlock('02/09 (terça)', [
      { name: 'Erick', startsAt: ERICK_STARTS },
    ]);
    assert.match(text, /início livre/);
    const times = text.match(/\d{2}:\d{2}/g) || [];
    assert.ok(times.length >= 6);
  });
});

describe('classifySlotPeriod', () => {
  test('09:00 → morning; 14:00 → afternoon', () => {
    assert.equal(classifySlotPeriod('2026-09-02T09:00:00-03:00'), 'morning');
    assert.equal(classifySlotPeriod('2026-09-02T14:00:00-03:00'), 'afternoon');
    assert.equal(classifySlotPeriod('2026-09-02T12:30:00-03:00'), 'morning');
    assert.equal(classifySlotPeriod('2026-09-02T13:00:00-03:00'), 'afternoon');
  });
});

describe('detectExactClock', () => {
  test('16:00 e 16h', () => {
    assert.deepEqual(detectExactClock('prefiro 16:00'), { hour: 16, minute: 0 });
    assert.deepEqual(detectExactClock('as 16h'), { hour: 16, minute: 0 });
  });

  test('K3 — 2h de atendimento não vira relógio', () => {
    assert.equal(detectExactClock('não são 2h de atendimento?'), null);
  });

  test('K4 — leva 2h não vira relógio', () => {
    assert.equal(detectExactClock('leva 2h'), null);
  });

  test('K5 — duração skip, as 16h permanece', () => {
    assert.deepEqual(
      detectExactClock('não são 2h de atendimento, prefere as 16h'),
      { hour: 16, minute: 0 },
    );
  });

  test('K6 — 10h30', () => {
    assert.deepEqual(detectExactClock('10h30'), { hour: 10, minute: 30 });
  });
});

describe('detectNamedProfessionals Onda 2 (§8 N)', () => {
  test('N1 — maquiador não é named person', () => {
    assert.deepEqual(detectNamedProfessionals('Quem é maquiador aí?'), []);
  });

  test('N2 — maquiadora + Fefe → só fefe', () => {
    const names = detectNamedProfessionals('maquiadora não é só a Fefe?');
    assert.deepEqual(names, ['fefe']);
  });

  test('N3 — corte com Tiago inalterado', () => {
    assert.ok(detectNamedProfessionals('corte com o Tiago').includes('tiago'));
  });
});

const FAT_CATALOG_11 = [
  { id: 1, nome: 'Corte Masculino', profissionais: ['André'], duracaoEmMinutos: 60 },
  { id: 2, nome: 'TA - Corte Masculino', profissionais: ['André'], duracaoEmMinutos: 60 },
  { id: 3, nome: 'Corte Feminino', profissionais: ['Giovanna'], duracaoEmMinutos: 120 },
  { id: 4, nome: 'Maquiagem', profissionais: ['Fefe'], duracaoEmMinutos: 120 },
  { id: 5, nome: 'Maquiagem Social', profissionais: ['Fefe'], duracaoEmMinutos: 120 },
  { id: 6, nome: 'Maquiagem Noiva', profissionais: ['Fefe'], duracaoEmMinutos: 120 },
  { id: 7, nome: 'Make Express', profissionais: ['Fefe'], duracaoEmMinutos: 120 },
  { id: 8, nome: 'Manicure', profissionais: ['Dylan'], duracaoEmMinutos: 45 },
  { id: 9, nome: 'Pedicure', profissionais: ['Dylan'], duracaoEmMinutos: 45 },
  { id: 10, nome: 'Coloração Global', profissionais: ['Jackie'], duracaoEmMinutos: 90 },
  { id: 11, nome: 'Retoque de Raiz', profissionais: ['Jackie'], duracaoEmMinutos: 60 },
];

const FOUR_MAQUIAGEM_120 = FAT_CATALOG_11.filter((s) => s.nome.startsWith('Maquiagem') || s.nome === 'Make Express');

describe('extractSpeechDurationMin / resolveOfferDurationMin (Chão 1)', () => {
  test('S1-1 — não são 2h de atendimento?', () => {
    assert.equal(extractSpeechDurationMin('não são 2h de atendimento?'), 120);
  });

  test('S1-2 — leva 2h', () => {
    assert.equal(extractSpeechDurationMin('leva 2h'), 120);
  });

  test('S1-3 — as 16h / sábado 14h não são duração', () => {
    assert.equal(extractSpeechDurationMin('as 16h'), 0);
    assert.equal(extractSpeechDurationMin('quero cortar sábado 14h'), 0);
  });

  test('S1-4 — 2h isolado não é duração', () => {
    assert.equal(extractSpeechDurationMin('2h'), 0);
  });

  test('S1-5 — 11 SKUs mistos sem opts → 0 (live cap)', () => {
    assert.equal(resolveOfferDurationMin(FAT_CATALOG_11), 0);
  });

  test('S1-6 — família homogénea >3 SKUs → 120', () => {
    assert.equal(resolveOfferDurationMin(FOUR_MAQUIAGEM_120), 120);
  });

  test('S1-7 — família maquiagem + fala atual → 120', () => {
    assert.equal(
      resolveOfferDurationMin(FOUR_MAQUIAGEM_120, { messageText: 'quero maquiagem com a Fefe' }),
      120,
    );
  });

  test('S1-8 — speech 2h com catálogo misto → 120', () => {
    assert.equal(
      resolveOfferDurationMin(FAT_CATALOG_11, { messageText: 'não são 2h de atendimento?' }),
      120,
    );
  });

  test('S1-9 — sem SKU nem duração → 0', () => {
    assert.equal(resolveOfferDurationMin([], { messageText: 'oi' }), 0);
    assert.equal(resolveOfferDurationMin([], { messageText: 'oi' }), 0);
  });

  test('S1-10 — 1 SKU 120 sem opts intacto', () => {
    assert.equal(resolveOfferDurationMin([{ duracaoEmMinutos: 120 }]), 120);
  });

  test('skuDurationFrom — misturado >3 → 0', () => {
    assert.equal(skuDurationFrom(FAT_CATALOG_11), 0);
  });
});

describe('compactBookingSlotsBlock duration occupancy (Chão 1)', () => {
  test('S1-11 — durationMin 120 sem janela contínua, sem relógio inventado', () => {
    const text = compactBookingSlotsBlock({
      label: '05/09 (sábado)',
      professionals: [{
        name: 'Fefe',
        professionalId: '826936',
        startsAt: ['2026-09-05T12:30:00-03:00'],
      }],
      messageText: 'quero maquiagem no sábado',
      durationMin: 120,
      allowedProfessionalNames: ['Fefe'],
    });
    assert.match(text, /sem janela contínua de 120min/);
    assert.doesNotMatch(text, /há vagas/);
    assert.doesNotMatch(text, /12:30/);
  });
});

describe('subtractOccupiedSlotStarts (Chão 2)', () => {
  test('F2 — appointment 12:00/60 remove start 12:30', () => {
    const professionals = [{
      name: 'Fefe',
      professionalId: '826936',
      startsAt: ['2026-09-05T12:30:00-03:00'],
    }];
    const appointments = [{
      professional_id: '826936',
      scheduled_at: '2026-09-05T12:00:00-03:00',
      duration_min: 60,
    }];
    const { professionals: filtered, subtractedOccupied } = subtractOccupiedSlotStarts(
      professionals,
      appointments,
    );
    assert.ok(subtractedOccupied >= 1);
    assert.equal(filtered.length, 0);
  });

  test('F3 — outro profissional / outro dia não remove', () => {
    const professionals = [{
      name: 'Erick',
      professionalId: '1',
      startsAt: ['2026-09-05T12:30:00-03:00'],
    }];
    const appointments = [{
      professional_id: '826936',
      scheduled_at: '2026-09-05T12:00:00-03:00',
      duration_min: 60,
    }];
    const { professionals: filtered, subtractedOccupied } = subtractOccupiedSlotStarts(
      professionals,
      appointments,
    );
    assert.equal(subtractedOccupied, 0);
    assert.deepEqual(filtered[0].startsAt, ['2026-09-05T12:30:00-03:00']);
  });
});

describe('snapshot.offer helpers (Chão 2)', () => {
  test('E1 — snapshot fresco emite offer sem exigir stale', () => {
    assert.equal(shouldEmitSnapshotOffer('BOOKING', 'HORARIOS VAGOS 02/09'), true);
    const evt = buildSnapshotOfferEventPayload({ snapshotAgeMin: 10 });
    assert.equal(evt.event, 'snapshot.offer');
    assert.equal(evt.payload.snapshot_age_min, 10);
    assert.equal(evt.payload.stale_after_min, SNAPSHOT_STALE_OFFER_MIN);
  });

  test('E2 — snapshot velho: stale threshold intacto', () => {
    const evt = buildSnapshotOfferEventPayload({ snapshotAgeMin: 90 });
    assert.equal(evt.payload.snapshot_age_min, 90);
    assert.equal(evt.payload.stale_after_min, 45);
  });
});
