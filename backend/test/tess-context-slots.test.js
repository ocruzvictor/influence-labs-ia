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

describe('detectNamedProfessionals', () => {
  test('detecta erick e andre', () => {
    const names = detectNamedProfessionals('quero cortar com o erick ou andré');
    assert.ok(names.includes('erick'));
    assert.ok(names.some((n) => n.includes('andre') || n.includes('andré')));
  });
});

describe('detectExactClock', () => {
  test('16:00 e 16h', () => {
    assert.deepEqual(detectExactClock('prefiro 16:00'), { hour: 16, minute: 0 });
    assert.deepEqual(detectExactClock('as 16h'), { hour: 16, minute: 0 });
  });
});
