/**
 * Testes unitários para backend/lib/booking-parser.js.
 *
 * Executa com Node test runner nativo (Node 18+, zero deps):
 *   node --test backend/test/booking-parser.test.js
 *   ou: cd backend && npm test
 *
 * Cobre a story bot-46589 (ajustes de resposta):
 *   - item 1: resolveServiceName (nome do serviço no card de confirmação)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveServiceName, renderFutureBookings, sanitizePrematureConfirm, renderHabilitacaoMap, formatIncompatibleProfServiceMessage, HABILITACAO_HEADER } = require('../lib/booking-parser');

const SERVICES = [
  { id: 12, nome: 'Corte Masculino' },
  { id: 34, nome: 'Avaliação para Mechas' },
  { id: 56, nome: 'Escova' },
];

test('item1.1 — resolve nome pelo ID (number)', () => {
  assert.equal(resolveServiceName(SERVICES, 34), 'Avaliação para Mechas');
});

test('item1.2 — resolve nome quando o ID vem como string (tag v2 parseada)', () => {
  assert.equal(resolveServiceName(SERVICES, '12'), 'Corte Masculino');
});

test('item1.3 — ID inexistente → null (caller degrada graciosamente, AC4)', () => {
  assert.equal(resolveServiceName(SERVICES, 999), null);
});

test('item1.4 — serviceId ausente/undefined → null', () => {
  assert.equal(resolveServiceName(SERVICES, undefined), null);
  assert.equal(resolveServiceName(SERVICES, null), null);
  assert.equal(resolveServiceName(SERVICES, 0), null);
});

test('item1.5 — data não-array (ex: Trinks falhou, data=[]/undefined) → null, nunca lança', () => {
  assert.equal(resolveServiceName([], 12), null);
  assert.equal(resolveServiceName(undefined, 12), null);
  assert.equal(resolveServiceName(null, 12), null);
});

test('item1.6 — item sem campo nome → null (não retorna undefined nem "id:")', () => {
  assert.equal(resolveServiceName([{ id: 7 }], 7), null);
});

// --- item 3 (Rota C): renderFutureBookings ---
const fmt = () => '03/06/2026 às 10:00'; // formatter stub

test('item3.1 — sem agendamentos → string vazia (sem seção)', () => {
  assert.equal(renderFutureBookings([], fmt), '');
  assert.equal(renderFutureBookings(null, fmt), '');
  assert.equal(renderFutureBookings(undefined, fmt), '');
});

test('item3.2 — 1 agendamento expõe bookingId real (trinks_id) + serviço + profissional', () => {
  const out = renderFutureBookings(
    [{ trinks_id: '486984217', service_name: 'Corte Masculino', professional_name: 'Erick', scheduled_at: 'x' }],
    fmt,
  );
  assert.match(out, /bookingId=486984217/);
  assert.match(out, /Corte Masculino com Erick em 03\/06\/2026 às 10:00/);
  assert.match(out, /AGENDAMENTOS FUTUROS DO CLIENTE/);
  assert.match(out, /cliente já identificado/);
  assert.match(out, /NAO peca nome/);
});

test('item3.3 — múltiplos → instrui a perguntar qual (desambiguação AC10)', () => {
  const out = renderFutureBookings(
    [
      { trinks_id: '1', service_name: 'Corte', professional_name: 'Erick', scheduled_at: 'a' },
      { trinks_id: '2', service_name: 'Barba', professional_name: 'Tiago', scheduled_at: 'b' },
    ],
    fmt,
  );
  assert.match(out, /bookingId=1/);
  assert.match(out, /bookingId=2/);
  assert.match(out, /PERGUNTE qual/);
});

test('item3.4 — sem professional_name não quebra; sem service_name usa fallback "serviço"', () => {
  const out = renderFutureBookings([{ trinks_id: '9', scheduled_at: 'a' }], fmt);
  assert.match(out, /bookingId=9 \| serviço em/);
  assert.ok(!/com undefined/.test(out), 'não imprime "com undefined"');
});

test('item3.5 — formatter ausente não lança (usa String como fallback)', () => {
  const out = renderFutureBookings([{ trinks_id: '9', service_name: 'X', scheduled_at: 'TS' }]);
  assert.match(out, /em TS/);
});

// --- cancel sanitizer (AC11) ---
test('cancel.1 — sanitize remove "Cancelando seu agendamento..." quando há tag', () => {
  const out = sanitizePrematureConfirm('Cancelando seu agendamento agora, um instante!');
  assert.ok(!/cancelando/i.test(out), 'não deve manter linguagem de cancelamento em progresso');
});

test('cancel.2 — sanitize remove "Vou pedir o cancelamento pra você"', () => {
  const out = sanitizePrematureConfirm('Vou pedir o cancelamento pra você 👀');
  assert.ok(!/cancelamento/i.test(out));
});

test('false-confirm — remove tá garantido / vou registrar / já marcado', () => {
  const out = sanitizePrematureConfirm('Tá garantido, vou registrar e a recepção confere. Já marcado!');
  assert.ok(!/garantido/i.test(out));
  assert.ok(!/vou registrar/i.test(out));
  assert.ok(!/já marcado/i.test(out));
});

test('false-confirm — Confirmado com vírgula (Bianca) também some', () => {
  const out = sanitizePrematureConfirm('Confirmado, Bianca. Vou registrar o teste.');
  assert.ok(!/confirmado/i.test(out));
  assert.ok(!/vou registrar/i.test(out));
});

// --- P0.5 sanitize turno seguinte (0101 / 9605 / 5668) ---
test('postFail.0101 — remove "já confirmamos" com flag pós-falha', () => {
  const out = sanitizePrematureConfirm(
    'Quer remarcar o corte que já confirmamos pra outro dia?',
    { afterFailOrBlock: true },
  );
  assert.ok(!/já confirmamos/i.test(out));
  assert.ok(!/ja confirmamos/i.test(out));
});

test('postFail.9605 — remove "tudo certo com [serviço]" com flag', () => {
  const out = sanitizePrematureConfirm(
    'Tudo certo com a manicure amanhã às 9h com a Fefe!',
    { afterFailOrBlock: true },
  );
  assert.ok(!/tudo certo com/i.test(out));
});

test('postFail.5668 — remove "seu agendamento está" com flag', () => {
  const out = sanitizePrematureConfirm(
    'Seu agendamento está confirmado para 17:30.',
    { afterFailOrBlock: true },
  );
  assert.ok(!/seu agendamento est/i.test(out));
});

test('postFail.semFlag — sem flag, padrões contextuais não stripam', () => {
  const out = sanitizePrematureConfirm('Quer remarcar o corte que já confirmamos?');
  assert.match(out, /já confirmamos/i);
});

test('postFail.5718 — combo 2º blocked remove Prontinho + fusão', () => {
  const out = sanitizePrematureConfirm(
    'Prontinho! Sua franja + Escova está marcada para 15:30.',
    { comboSecondBlocked: true },
  );
  assert.ok(!/prontinho/i.test(out));
  assert.ok(!/franja.*escova/i.test(out));
});

test('postFail.taCerto — pergunta "Tá certo?" NÃO é stripada', () => {
  const out = sanitizePrematureConfirm('Tá certo? Posso registrar esse horário?');
  assert.match(out, /Tá certo\?/);
});

test('postFail.8397 — cancel copy intacta (sem tag booking)', () => {
  const cancelCopy = 'Não consegui localizar/cancelar seu horário automaticamente 😕\nVou pedir pra recepção resolver com você. Um momento!';
  const out = sanitizePrematureConfirm(cancelCopy);
  assert.match(out, /Não consegui localizar\/cancelar/);
  assert.match(out, /recepção resolver/);
});

// --- item 2: renderHabilitacaoMap ---
test('item2.1 — lista vazia / null → string vazia', () => {
  assert.equal(renderHabilitacaoMap([]), '');
  assert.equal(renderHabilitacaoMap(null), '');
  assert.equal(renderHabilitacaoMap(undefined), '');
});

test('item2.2 — serviços sem profissionais habilitados → string vazia', () => {
  assert.equal(renderHabilitacaoMap([{ id: 1, nome: 'X', profissionais: [] }]), '');
  assert.equal(renderHabilitacaoMap([{ id: 1, nome: 'X' }]), '');
});

test('item2.3 — um serviço com nomes presentes inclui header HABILITACAO e linha formatada', () => {
  const out = renderHabilitacaoMap([
    { id: 14129499, nome: 'Corte Masculino', profissionais: ['Erick', 'Tiago'] },
  ]);
  assert.match(out, new RegExp(HABILITACAO_HEADER.replace(/[()]/g, '\\$&')));
  assert.match(out, /Corte Masculino \(ID 14129499\): Erick, Tiago/);
  assert.match(out, /ignore HORARIOS VAGOS/);
});

test('item2.4 — múltiplos serviços listados; contexto dinâmico conteria HABILITACAO antes de slots', () => {
  const habilitacao = renderHabilitacaoMap([
    { id: 12, nome: 'Corte Masculino', profissionais: ['Erick', 'Tiago'] },
    { id: 34, nome: 'Escova', profissionais: ['Ana'] },
  ]);
  const slotsStub = 'HORARIOS VAGOS sabado:\n- Dylan: 10:00';
  const contextStub = ['DATAS COM DADOS DISPONIVEIS: sabado', '', habilitacao, slotsStub].join('\n');
  const habIdx = contextStub.indexOf('HABILITACAO');
  const slotsIdx = contextStub.indexOf('HORARIOS VAGOS');
  assert.ok(habIdx >= 0, 'contexto deve conter HABILITACAO');
  assert.ok(habIdx < slotsIdx, 'HABILITACAO deve vir antes de HORARIOS VAGOS');
  assert.match(contextStub, /Escova \(ID 34\): Ana/);
});

test('item2.5 — formatIncompatibleProfServiceMessage cita habilitados', () => {
  const msg = formatIncompatibleProfServiceMessage({
    professionalName: 'Dylan',
    serviceName: 'Corte Masculino',
    enabledProfessionals: ['Erick', 'Tiago'],
  });
  assert.match(msg, /Dylan não realiza Corte Masculino/);
  assert.match(msg, /Erick, Tiago/);
  assert.ok(!/problema técnico/i.test(msg));
});

test('item2.6 — recusa Dylan lista só os serviços reais do profissional (sem cabelo inventado)', () => {
  const msg = formatIncompatibleProfServiceMessage({
    professionalName: 'Dylan',
    serviceName: 'Corte Masculino',
    enabledProfessionals: ['Erick'],
    professionalServices: ['Manicure', 'Pedicure', 'Alongamento em gel'],
  });
  assert.match(msg, /Dylan atende: Manicure, Pedicure, Alongamento em gel/);
  assert.ok(!/capilar/i.test(msg));
  assert.ok(!/cabelo/i.test(msg));
});

test('catalog.1 — linha de serviço inclui preço e duração do snapshot', () => {
  const { formatServiceCatalogLine, formatBrl } = require('../lib/booking-parser');
  assert.equal(formatBrl(190), 'R$ 190');
  const line = formatServiceCatalogLine({
    id: 14129512,
    nome: 'Corte Feminino',
    preco: 190,
    duracaoEmMinutos: 120,
    profissionais: ['Giovanna', 'Jackie'],
  });
  assert.match(line, /Corte Feminino \[Giovanna, Jackie\] \(ID 14129512\) — R\$ 190 · 120min/);
});

test('catalog.1b — SKU laser recebe alias (laser) antes dos colchetes', () => {
  const { formatServiceCatalogLine } = require('../lib/booking-parser');
  const line = formatServiceCatalogLine({
    id: 15137040,
    nome: 'Depilação em 1 área',
    preco: 499,
    duracaoEmMinutos: 30,
    profissionais: ['Claudia'],
  });
  assert.match(line, /Depilação em 1 área \(laser\) \[Claudia\] \(ID 15137040\) — R\$ 499 · 30min/);
});

test('catalog.2 — servicesForProfessional filtra pelo apelido exato', () => {
  const { servicesForProfessional } = require('../lib/booking-parser');
  const list = [
    { nome: 'Manicure', profissionais: ['Dylan'] },
    { nome: 'Corte Masculino', profissionais: ['Erick'] },
    { nome: 'Pedicure', profissionais: ['Dylan'] },
  ];
  assert.deepEqual(servicesForProfessional(list, 'Dylan'), ['Manicure', 'Pedicure']);
});

test('catalog.filter — pé/pés mapeia Pedicure + Depilação de Pé, não corte', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const list = [
    { id: 1, nome: 'Corte Masculino' },
    { id: 2, nome: 'Pedicure' },
    { id: 3, nome: 'Manicure' },
    { id: 4, nome: 'Depilação de Pé' },
  ];
  const pe = filterServicesByKeywords(list, 'queria fazer o pé sábado');
  assert.ok(pe?.some((s) => s.nome === 'Pedicure'));
  assert.ok(pe?.some((s) => s.nome === 'Depilação de Pé'));
  assert.ok(!pe?.some((s) => s.nome === 'Corte Masculino'));
  const mao = filterServicesByKeywords(list, 'queria fazer a mão amanhã');
  assert.deepEqual((mao || []).map((s) => s.nome), ['Manicure']);
});

test('catalog.filter — penteado não dispara sinônimo pé', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const list = [
    { id: 1, nome: 'Penteado' },
    { id: 2, nome: 'Pedicure' },
  ];
  const out = filterServicesByKeywords(list, 'quero um penteado de festa');
  assert.ok(out?.some((s) => s.nome === 'Penteado'));
  assert.ok(!out?.some((s) => s.nome === 'Pedicure'));
});

test('catalog.filter — penteado dia a dia inclui corte, festa não', () => {
  const { filterServicesByKeywords, isColloquialPenteado } = require('../lib/booking-parser');
  const list = [
    { id: 1, nome: 'Penteado' },
    { id: 2, nome: 'Corte Masculino' },
    { id: 3, nome: 'Pedicure' },
  ];
  assert.equal(isColloquialPenteado('Penteado para o dia a dia'), true);
  assert.equal(isColloquialPenteado('quero um penteado de festa'), false);
  const colloquial = filterServicesByKeywords(list, 'Penteado para o dia a dia');
  assert.ok(colloquial?.some((s) => s.nome === 'Penteado'));
  assert.ok(colloquial?.some((s) => s.nome === 'Corte Masculino'));
  assert.ok(!colloquial?.some((s) => s.nome === 'Pedicure'));
});

test('dados-cliente.1 — cliente recorrente + phone → DADOS_CLIENTE (nunca PERFIL)', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  const out = buildPersistedSection({
    client: {
      name: 'Victor Cruz',
      last_service: 'Corte Masculino',
      last_visit: new Date('2026-08-17T19:24:14Z'),
      visit_count: 5,
    },
  }, '5511964540007');
  assert.match(out, /DADOS_CLIENTE:/);
  assert.match(out, /Nome: Victor Cruz \(WhatsApp — NAO peca de novo\)/);
  assert.match(out, /Telefone: 5511964540007/);
  assert.match(out, /Ultimo servico: Corte Masculino/);
  assert.doesNotMatch(out, /PERFIL DO CLIENTE/);
});

test('dados-cliente.2 — só phone, sem clients → Telefone, sem Nome', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  const out = buildPersistedSection(null, '+55 11 96454-0007');
  assert.match(out, /DADOS_CLIENTE:/);
  assert.match(out, /Telefone: 5511964540007/);
  assert.doesNotMatch(out, /Nome:/);
});

test('dados-cliente.3 — sem memory e sem phone → vazio', () => {
  const { buildPersistedSection } = require('../lib/booking-parser');
  assert.equal(buildPersistedSection(null, null), '');
  assert.equal(buildPersistedSection({}, ''), '');
});

test('sanitize.cliente — remove turno inventado Cliente:', () => {
  const { sanitizeInventedClientTurns } = require('../lib/booking-parser');
  const out = sanitizeInventedClientTurns('Posso marcar 14:30.\nCliente: 14:30\nFechado então.');
  assert.ok(!/Cliente:/i.test(out));
  assert.match(out, /Posso marcar 14:30/);
});

test('parser.combo — duas tags BOOKING_CREATE viram bookingCreates', () => {
  const { stripBookingTags } = require('../lib/booking-parser');
  const text = 'Confirmo aqui então 👀\n[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-08-18T14:00:00-03:00 valor=90 duracaoMinutos=60]\n[BOOKING_CREATE servicoId=2 profissionalId=3 dataHoraInicio=2026-08-18T15:00:00-03:00 valor=60 duracaoMinutos=30]';
  const parsed = stripBookingTags(text);
  assert.equal(parsed.bookingCreates.length, 2);
  assert.equal(parsed.bookingConfirm.service_id, 1);
  assert.equal(parsed.bookingCreates[1].service_id, 2);
  assert.ok(!/BOOKING_CREATE/.test(parsed.clean));
});

// --- Fase D Gi (AC17/AC21) ---
test('faseD.cancel — 3 BOOKING_CANCEL → bookingCancels.length===3 e clean sem tag', () => {
  const { stripBookingTags } = require('../lib/booking-parser');
  const text = [
    'Ok!',
    '[BOOKING_CANCEL bookingId=111 motivo=teste]',
    '[BOOKING_CANCEL bookingId=222 motivo=teste]',
    '[BOOKING_CANCEL bookingId=333 motivo=teste]',
  ].join('\n');
  const parsed = stripBookingTags(text);
  assert.equal(parsed.bookingCancels.length, 3);
  assert.equal(parsed.bookingCancel.agendamento_id, 111);
  assert.ok(!/BOOKING_CANCEL/.test(parsed.clean));
});

test('faseD.leak — stripResidualBookingTags remove tags residuais', () => {
  const { stripResidualBookingTags } = require('../lib/booking-parser');
  const out = stripResidualBookingTags('Pronto! [BOOKING_CREATE servicoId=1] [HANDOFF_HUMAN motivo=x]');
  assert.ok(!/\[BOOKING_/.test(out));
  assert.ok(!/\[HANDOFF_/.test(out));
  assert.match(out, /Pronto!/);
});

test('hotfix D1 — CHECK_AVAILABILITY removida; marcador de imagem preservado', () => {
  const { stripResidualBookingTags, stripBookingTags } = require('../lib/booking-parser');
  const leaked = 'Vou verificar [CHECK_AVAILABILITY profissional=Erick data=2026-09-02 periodo=tarde horarioEspecifico=14:30] pra você.';
  const out = stripResidualBookingTags(leaked);
  assert.ok(!/CHECK_AVAILABILITY/.test(out));
  assert.ok(!/\[CHECK_/.test(out));
  assert.match(out, /Vou verificar/);

  const withImage = 'Recebi sua referência [CLIENTE ENVIOU IMAGEM] — lindo coque!';
  assert.match(stripResidualBookingTags(withImage), /\[CLIENTE ENVIOU IMAGEM\]/);

  const createTag = '[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-09-02T14:30:00-03:00 valor=90 duracaoMinutos=60]';
  const parsed = stripBookingTags(`Confirmo ${createTag}`);
  assert.equal(parsed.bookingCreates.length, 1);
  assert.ok(!/BOOKING_CREATE/.test(parsed.clean));
});

test('vinicius angeli — Validação rápida, fence e TA- não vazam', () => {
  const { stripResidualBookingTags } = require('../lib/booking-parser');
  const leaked = [
    'Ótimo! No sábado (05/09) à tarde, tenho 17h para você com o Tiago. Corte Masculino, R$ 105. Confirma? 😊',
    '',
    '[Validação rápida: sábado 05/09, Tiago 17:00 tem 60min contínuos, Corte Masculino (TA) = 60min. ✓ Cabe perfeitamente e termina às 18h (fechamento sábado).]',
  ].join('\n');
  const out = stripResidualBookingTags(leaked);
  assert.ok(!/Validação/i.test(out));
  assert.ok(!/60min contínuos/.test(out));
  assert.ok(!/fechamento sábado/.test(out));
  assert.match(out, /Confirma/);
  assert.match(out, /17h/);

  const fence = '`'.repeat(3);
  const withCode = `Horário ok.\n${fence}javascript\nfunction checkSlot(){ return true; }\n${fence}\nConfirma?`;
  const outCode = stripResidualBookingTags(withCode);
  assert.ok(!/function checkSlot/.test(outCode));
  assert.ok(!/```/.test(outCode));
  assert.match(outCode, /Confirma/);

  const withSku = 'No sábado às 10h30, o Tiago tem disponibilidade para Corte Masculino (TA - Corte Masculino).';
  const outSku = stripResidualBookingTags(withSku);
  assert.ok(!/TA\s*-/.test(outSku));
  assert.match(outSku, /Corte Masculino/);
});

test('faseD.sanitize — Cancelei os três não mantém cancelei', () => {
  const out = sanitizePrematureConfirm('Cancelei os três horários pra você.');
  assert.ok(!/cancelei/i.test(out));
});

test('faseD.catalog — Luzes preco 0 → sob avaliação, não R$ 0', () => {
  const { formatServiceCatalogLine } = require('../lib/booking-parser');
  const line = formatServiceCatalogLine({ id: 14129487, nome: 'Luzes', preco: 0, duracaoEmMinutos: 180, profissionais: ['Giovanna'] });
  assert.match(line, /sob avaliação/i);
  assert.ok(!/R\$ 0/.test(line));
});

test('faseD.catalog — Teste de Mechas preco 0 → gratuito, não sob avaliação', () => {
  const { formatServiceCatalogLine } = require('../lib/booking-parser');
  const line = formatServiceCatalogLine({ id: 1, nome: 'Teste de Mechas', preco: 0, profissionais: ['Giovanna'] });
  assert.match(line, /gratuito/i);
  assert.ok(!/sob avaliação/i.test(line));
});

test('faseD.consultive — isConsultiveColorService Luzes true, Teste de Mechas false', () => {
  const { isConsultiveColorService } = require('../lib/booking-parser');
  assert.equal(isConsultiveColorService('Luzes'), true);
  assert.equal(isConsultiveColorService('Teste de Mechas'), false);
});

test('faseD.ownership — isBookingOwnedByClient cruza trinks_id', () => {
  const { isBookingOwnedByClient } = require('../lib/booking-parser');
  const owned = [{ trinks_id: '486984217' }, { trinks_id: '999' }];
  assert.equal(isBookingOwnedByClient('486984217', owned), true);
  assert.equal(isBookingOwnedByClient(486984217, owned), true);
  assert.equal(isBookingOwnedByClient('000', owned), false);
});

test('faseD.consultiveMsg — formatConsultiveBlockMessage copy estável', () => {
  const { formatConsultiveBlockMessage } = require('../lib/booking-parser');
  const msg = formatConsultiveBlockMessage();
  assert.match(msg, /Teste de Mechas gratuito/i);
  assert.match(msg, /presencialmente/i);
});

// --- Fase E (penteado/maquiagem consultivo) ---
test('faseE.needsReference — penteado e maquiagem true; escova e mechas false', () => {
  const { needsReferenceService, isConsultiveColorService } = require('../lib/booking-parser');
  assert.equal(needsReferenceService('Penteado Semi Preso'), true);
  assert.equal(needsReferenceService('Maquiagem'), true);
  assert.equal(needsReferenceService('Make'), true);
  assert.equal(needsReferenceService('Escova'), false);
  assert.equal(needsReferenceService('Teste de Mechas'), false);
  assert.equal(isConsultiveColorService('Luzes'), true);
  assert.equal(needsReferenceService('Luzes'), false);
});

test('faseE.zeroPrice — copy própria, não menciona Teste de Mechas', () => {
  const { formatZeroPriceBlockMessage, formatConsultiveBlockMessage } = require('../lib/booking-parser');
  const zero = formatZeroPriceBlockMessage();
  const consultive = formatConsultiveBlockMessage();
  assert.match(zero, /sob avaliação/i);
  assert.match(zero, /equipe confirma/i);
  assert.ok(!/Teste de Mechas/i.test(zero));
  assert.match(consultive, /Teste de Mechas/i);
});

test('faseE.catalog — escova e penteado usam a partir de; corte não', () => {
  const { formatServiceCatalogLine } = require('../lib/booking-parser');
  const escova = formatServiceCatalogLine({ id: 1, nome: 'Escova', preco: 70, profissionais: ['Ana'] });
  const penteado = formatServiceCatalogLine({ id: 2, nome: 'Penteado Preso', preco: 150, profissionais: ['Gi'] });
  const corte = formatServiceCatalogLine({ id: 3, nome: 'Corte Feminino', preco: 190, profissionais: ['Gi'] });
  assert.match(escova, /a partir de R\$ 70/);
  assert.match(penteado, /a partir de R\$ 150/);
  assert.match(corte, /— R\$ 190/);
  assert.ok(!/a partir de/.test(corte));
});

test('faseE.needsRefMsg — penteado pede foto + Gi; maquiagem Fefe', () => {
  const { formatNeedsReferenceBlockMessage } = require('../lib/booking-parser');
  const pent = formatNeedsReferenceBlockMessage({ serviceName: 'Penteado', price: 120 });
  assert.match(pent, /foto de referência/i);
  assert.match(pent, /Gi \(Giovanna Ferraz\)/i);
  assert.match(pent, /a partir de R\$ 120/);
  assert.ok(!/preso/i.test(pent));
  assert.ok(!/semi/i.test(pent));
  assert.ok(!/Teste de Mechas/i.test(pent));

  const mk = formatNeedsReferenceBlockMessage({ serviceName: 'Maquiagem', price: 80, hasReferenceImage: true });
  assert.match(mk, /Fefe \(Fernanda\)/i);
  assert.match(mk, /Recebi sua referência/i);
});

test('faseE.habilitacao — maquiagem só Fefe mesmo com Eli/Kamila no Trinks', () => {
  const { applyOperationalHabilitacao, renderHabilitacaoMap } = require('../lib/booking-parser');
  const list = applyOperationalHabilitacao([
    { id: 1, nome: 'Maquiagem', profissionais: ['Eli', 'Fefe', 'Kamila'] },
    { id: 2, nome: 'Penteado trança preso', profissionais: ['Eli', 'Giovanna Ferraz', 'Tiago Rocha'] },
    { id: 3, nome: 'Corte Feminino', profissionais: ['Eli', 'Fefe', 'Giovanna Ferraz'] },
    { id: 4, nome: 'Escova', profissionais: ['Eli', 'Fefe', 'Giovanna Ferraz'] },
  ]);
  assert.deepEqual(list[0].profissionais, ['Fefe']);
  assert.deepEqual(list[1].profissionais, ['Giovanna Ferraz']);
  assert.deepEqual(list[2].profissionais, ['Eli', 'Fefe', 'Giovanna Ferraz']);
  assert.deepEqual(list[3].profissionais, ['Eli', 'Fefe', 'Giovanna Ferraz']);
  const map = renderHabilitacaoMap(list);
  assert.match(map, /Maquiagem \(ID 1\): Fefe/);
  assert.doesNotMatch(map, /Maquiagem \(ID 1\):.*Eli/);
  assert.doesNotMatch(map, /Maquiagem \(ID 1\):.*Kamila/);
});

test('faseE.habilitacao — maquiagem sem Fefe no snapshot ainda força Fefe', () => {
  const { applyOperationalHabilitacao } = require('../lib/booking-parser');
  const list = applyOperationalHabilitacao([
    { id: 9, nome: 'Maquiagem', profissionais: ['Eli', 'Kamila'] },
  ]);
  assert.deepEqual(list[0].profissionais, ['Fefe']);
});

test('faseE.imageMarker — hasRecentClientImageMarker ignora sticker', () => {
  const { hasRecentClientImageMarker, CLIENT_IMAGE_MARKER } = require('../lib/booking-parser');
  const { STICKER_MARKER } = require('../lib/kapso-media');
  const hist = [
    { role: 'user', content: `${STICKER_MARKER}` },
    { role: 'assistant', content: 'oi' },
  ];
  assert.equal(hasRecentClientImageMarker(hist), false);
  hist.push({ role: 'user', content: `${CLIENT_IMAGE_MARKER} coque` });
  assert.equal(hasRecentClientImageMarker(hist), true);
});

// --- Onda 2 Fase A — triagem tetos (§8 C/G/S) ---
const CATALOG_FIXTURE = [
  { id: 1, nome: 'Corte Masculino' },
  { id: 2, nome: 'Corte Feminino' },
  { id: 3, nome: 'Pedicure' },
  { id: 4, nome: 'Manicure' },
  { id: 5, nome: 'Cabelo e Barba' },
  { id: 6, nome: 'Coloração Global' },
  { id: 7, nome: 'Retoque de Raiz' },
  { id: 8, nome: 'Tonalização' },
  { id: 9, nome: 'Maquiagem' },
  { id: 10, nome: 'Progressiva' },
];

test('C1 — tintura filtra família química, não null', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'valor para tintura');
  assert.ok(out);
  assert.ok(out.some((s) => s.nome === 'Coloração Global'));
  assert.ok(out.some((s) => s.nome === 'Retoque de Raiz'));
  assert.ok(out.some((s) => s.nome === 'Tonalização'));
});

test('C2 — gloss filtra família química', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'trabalham com gloss?');
  assert.ok(out);
  assert.ok(out.some((s) => s.nome === 'Coloração Global'));
  assert.ok(!out.some((s) => /gloss/i.test(s.nome)));
});

test('C3 — pezinho do cabelo só → [] (cortesia, sem corte/pedicure)', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const msg = 'Posso passar aí pra arrumar o pezinho do cabelo?';
  const out = filterServicesByKeywords(CATALOG_FIXTURE, msg);
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 0);
  assert.ok(!out?.some((s) => s.nome === 'Corte Masculino'));
  assert.ok(!out?.some((s) => s.nome === 'Pedicure'));
  assert.ok(!out?.some((s) => s.nome === 'Cabelo e Barba'));
});

test('C4 — Pezinho do cabelo isColloquialPezinho; filter [] no turno só-pezinho', () => {
  const { filterServicesByKeywords, isColloquialPezinho } = require('../lib/booking-parser');
  assert.equal(isColloquialPezinho('Pezinho do cabelo'), true);
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'Pezinho do cabelo');
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 0);
  assert.ok(!out?.some((s) => s.nome === 'Pedicure'));
});

test('C5 — pé sábado inalterado → Pedicure', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'queria fazer o pé sábado');
  assert.ok(out?.some((s) => s.nome === 'Pedicure'));
  assert.ok(!out?.some((s) => s.nome === 'Corte Masculino'));
});

test('C6 — pé e mão → Pedicure e Manicure', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'marcar um horário para pé e mão');
  assert.ok(out?.some((s) => s.nome === 'Pedicure'));
  assert.ok(out?.some((s) => s.nome === 'Manicure'));
});

test('P8-1 — isSoloPezinhoTurn smoke #2', () => {
  const { isSoloPezinhoTurn } = require('../lib/booking-parser');
  assert.equal(
    isSoloPezinhoTurn('Posso passar aí pra arrumar o pezinho do cabelo?'),
    true,
  );
});

test('P8-2 — corte + pezinho não é só-pezinho', () => {
  const { isSoloPezinhoTurn } = require('../lib/booking-parser');
  assert.equal(isSoloPezinhoTurn('quero um corte e o pezinho'), false);
});

test('P8-3 — fazer o pé / pé e mão não é só-pezinho', () => {
  const { isSoloPezinhoTurn } = require('../lib/booking-parser');
  assert.equal(isSoloPezinhoTurn('fazer o pé'), false);
  assert.equal(isSoloPezinhoTurn('pé e mão'), false);
});

test('P8-6 — corte e pezinho mantém Corte Masculino', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'quero um corte e o pezinho');
  assert.ok(out?.some((s) => s.nome === 'Corte Masculino'));
  assert.ok(!out?.some((s) => s.nome === 'Pedicure'));
});

test('P8-7 — suppressSoloPezinhoTags remove CREATE e handoff orcamento', () => {
  const { stripBookingTags, suppressSoloPezinhoTags } = require('../lib/booking-parser');
  const inbound = 'Posso passar aí pra arrumar o pezinho do cabelo?';
  const text = [
    'Pode passar sem marcar.',
    '[HANDOFF_HUMAN motivo=orcamento_referencia]',
    '[BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-09-05T14:00:00-03:00 valor=0 duracaoMinutos=30]',
  ].join('\n');
  const parsed = suppressSoloPezinhoTags(stripBookingTags(text), inbound);
  assert.equal(parsed.bookingCreates.length, 0);
  assert.equal(parsed.bookingConfirm, null);
  assert.equal(parsed.handoffHuman, null);
  assert.match(parsed.clean, /Pode passar sem marcar/);
  assert.ok(!/\[HANDOFF_HUMAN/.test(parsed.clean));
  assert.ok(!/\[BOOKING_CREATE/.test(parsed.clean));
});

test('C8 — masculino exclui Corte Feminino', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'Masculino', { genderQualifier: 'masculino' });
  assert.ok(out?.some((s) => s.nome === 'Corte Masculino'));
  assert.ok(!out?.some((s) => s.nome === 'Corte Feminino'));
});

test('C9 — progressiva masculina não regride', () => {
  const { filterServicesByKeywords } = require('../lib/booking-parser');
  const out = filterServicesByKeywords(CATALOG_FIXTURE, 'Qual valor da progressiva masculina?');
  assert.ok(out?.some((s) => s.nome === 'Progressiva'));
});

test('G1-G4 — detectGenderQualifier e applyGenderQualifier', () => {
  const {
    detectGenderQualifier,
    applyGenderQualifier,
  } = require('../lib/booking-parser');
  assert.equal(detectGenderQualifier('Masculino'), 'masculino');
  assert.equal(detectGenderQualifier('É masculino'), 'masculino');
  assert.equal(detectGenderQualifier('Tem horário a tarde'), null);
  assert.equal(detectGenderQualifier('É feminino, quero masculino'), 'masculino');
  assert.equal(detectGenderQualifier('Masculino depois feminino'), 'feminino');
  const qualified = applyGenderQualifier(CATALOG_FIXTURE, 'masculino');
  assert.ok(qualified.some((s) => s.nome === 'Corte Masculino'));
  assert.ok(qualified.some((s) => s.nome === 'Manicure'));
  assert.ok(!qualified.some((s) => s.nome === 'Corte Feminino'));
});

test('S2-S8 — strip TA, HABILITACAO, ID; preserva imagem', () => {
  const { stripResidualBookingTags } = require('../lib/booking-parser');
  assert.ok(!/TA\s*-/i.test(stripResidualBookingTags('TA - Corte Masculino no sábado')));
  assert.match(stripResidualBookingTags('TA - Corte Masculino'), /Corte Masculino/);
  assert.ok(!/TA\s*-/.test(stripResidualBookingTags('Corte Masculino (TA - Corte Masculino)')));
  const inline4749 = 'tenho 17h [Validação rápida: sábado 05/09 … (TA) = 60min] Confirma?';
  const out4749 = stripResidualBookingTags(inline4749);
  assert.ok(!/Validação/i.test(out4749));
  assert.ok(!/\(TA\)/i.test(out4749));
  assert.match(out4749, /Confirma/);
  assert.ok(!/Consultando\s+HABILITACAO/i.test(stripResidualBookingTags('Consultando HABILITACAO')));
  assert.ok(!/HABILITACAO\s*\(/i.test(stripResidualBookingTags('HABILITACAO (só ofereça profissional listado…)')));
  assert.ok(!/ID\s+14129543/.test(stripResidualBookingTags('Profissionais ID 14129543 disponíveis')));
  assert.ok(!/\(ID\s+14129543\)/.test(stripResidualBookingTags('Ver (ID 14129543) agora')));
  assert.match(stripResidualBookingTags('Referência [CLIENTE ENVIOU IMAGEM] linda'), /\[CLIENTE ENVIOU IMAGEM\]/);
});
