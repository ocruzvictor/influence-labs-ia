/**
 * Testes unitários — backend/lib/owner-resume-parser.js
 *
 *   node --test backend/test/owner-resume-parser.test.js
 */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const parserPath = require.resolve('../lib/owner-resume-parser');
const resumePath = require.resolve('../lib/resume-conversation');

let resumeCalls = [];

function loadParser() {
  delete require.cache[parserPath];
  delete require.cache[resumePath];
  require.cache[resumePath] = {
    id: resumePath,
    filename: resumePath,
    loaded: true,
    exports: {
      NOTE_MIN: 20,
      NOTE_MAX: 500,
      normalizeNote: (n) => String(n || '').trim().replace(/\s+/g, ' '),
      resumeConversation: async (phone, { note, actor }, _deps) => {
        resumeCalls.push({ phone, note, actor });
        return { httpStatus: 200, body: { status: 'sent' } };
      },
    },
  };
  return require('../lib/owner-resume-parser');
}

beforeEach(() => {
  resumeCalls = [];
});

test('matchesResumeAnchor — âncoras case-insensitive', () => {
  const p = loadParser();
  assert.equal(p.matchesResumeAnchor('retomar Bianca. Agenda o teste de mecha agora'), true);
  assert.equal(p.matchesResumeAnchor('RETOMA cliente. Orientação longa o suficiente aqui'), true);
  assert.equal(p.matchesResumeAnchor('Volta a IA por favor. Nota com vinte chars+'), true);
  assert.equal(p.matchesResumeAnchor('Pode voltar Maria. Seguir fluxo consultivo normal'), true);
  assert.equal(p.matchesResumeAnchor('/resume algo'), false);
  assert.equal(p.matchesResumeAnchor('preco corte masculino'), false);
});

test('extractNoteFromRemainder — strip nome e valida 20–500', () => {
  const p = loadParser();
  const ok = p.extractNoteFromRemainder(
    'Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
  );
  assert.equal(ok.ok, true);
  assert.ok(ok.note.length >= 20);
  assert.match(ok.note, /Agenda o teste de mecha/);

  const short = p.extractNoteFromRemainder('Bianca. curta');
  assert.equal(short.ok, false);
  assert.equal(short.error, 'missing_note');
});

test('resolveTargetPhone — 0 pendentes recusa', () => {
  const p = loadParser();
  const r = p.resolveTargetPhone({
    fullText: 'retomar Bianca. nota qualquer',
    remainder: 'Bianca. nota qualquer',
    pendings: [],
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'none_pending');
});

test('resolveTargetPhone — 1 pendente implícito mesmo com nome', () => {
  const p = loadParser();
  const r = p.resolveTargetPhone({
    fullText: 'retomar Bianca. Agenda o teste de mecha — obrigatório aqui',
    remainder: 'Bianca. Agenda o teste de mecha — obrigatório aqui',
    pendings: [{ phone: '5511999999999', name: 'Bianca' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.phone, '5511999999999');
});

test('resolveTargetPhone — N pendentes ambíguo sem telefone/nome único', () => {
  const p = loadParser();
  const pendings = [
    { phone: '5511111111111', name: 'Ana' },
    { phone: '5511222222222', name: 'Bia' },
  ];
  const r = p.resolveTargetPhone({
    fullText: 'retomar. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    remainder: 'Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    pendings,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'ambiguous');
  assert.equal(r.pendings.length, 2);
});

test('resolveTargetPhone — N pendentes desambigua por telefone na msg', () => {
  const p = loadParser();
  const pendings = [
    { phone: '5511111111111', name: 'Ana' },
    { phone: '5511222222222', name: 'Bia' },
  ];
  const r = p.resolveTargetPhone({
    fullText: 'retomar 5511222222222. Agenda o teste de mecha — obrigatório, independente da venda.',
    remainder: '5511222222222. Agenda o teste de mecha — obrigatório, independente da venda.',
    pendings,
  });
  assert.equal(r.ok, true);
  assert.equal(r.phone, '5511222222222');
});

test('resolveTargetPhone — N pendentes desambigua por nome único', () => {
  const p = loadParser();
  const pendings = [
    { phone: '5511111111111', name: 'Ana' },
    { phone: '5511222222222', name: 'Bia' },
  ];
  const r = p.resolveTargetPhone({
    fullText: 'retomar Bia. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    remainder: 'Bia. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    pendings,
  });
  assert.equal(r.ok, true);
  assert.equal(r.phone, '5511222222222');
});

test('shouldAttemptOwnerResume — thread cliente ignorada', () => {
  const p = loadParser();
  assert.equal(
    p.shouldAttemptOwnerResume(false, 'retomar Bianca. Agenda o teste de mecha — obrigatório aqui'),
    false,
  );
  assert.equal(
    p.shouldAttemptOwnerResume(true, 'retomar Bianca. Agenda o teste de mecha — obrigatório aqui'),
    true,
  );
});

test('handleOwnerResumeInbound — 0 pendentes ack sem resumeConversation', async () => {
  const p = loadParser();
  const acks = [];
  const handled = await p.handleOwnerResumeInbound({
    messageText: 'retomar Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    db: { query: async () => ({ rows: [] }) },
    resumeDeps: {},
    sendAck: async (t) => { acks.push(t); },
  });
  assert.equal(handled.handled, true);
  assert.equal(resumeCalls.length, 0);
  assert.match(acks[0], /Nenhum handoff pendente/);
});

test('handleOwnerResumeInbound — 1 pendente chama resumeConversation actor whatsapp', async () => {
  const p = loadParser();
  const acks = [];
  await p.handleOwnerResumeInbound({
    messageText: 'retomar Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.',
    db: {
      query: async () => ({
        rows: [{ phone: '5511999999999', name: 'Bianca' }],
      }),
    },
    resumeDeps: {},
    sendAck: async (t) => { acks.push(t); },
  });
  assert.equal(resumeCalls.length, 1);
  assert.equal(resumeCalls[0].phone, '5511999999999');
  assert.equal(resumeCalls[0].actor, 'whatsapp');
  assert.ok(resumeCalls[0].note.length >= 20);
  assert.match(acks[0], /Retomada enviada/);
});

test('handleOwnerResumeInbound — nota curta ack falta nota', async () => {
  const p = loadParser();
  const acks = [];
  await p.handleOwnerResumeInbound({
    messageText: 'retomar Bianca. curta',
    db: { query: async () => ({ rows: [{ phone: '5511999999999', name: 'Bianca' }] }) },
    resumeDeps: {},
    sendAck: async (t) => { acks.push(t); },
  });
  assert.equal(resumeCalls.length, 0);
  assert.match(acks[0], /Falta a orientação/);
});

test('formatResumeResultAck — mapeia sent e window_closed', () => {
  const p = loadParser();
  assert.match(p.formatResumeResultAck({ httpStatus: 200, body: { status: 'sent' } }), /enviada/);
  assert.match(
    p.formatResumeResultAck({ httpStatus: 200, body: { status: 'window_closed' } }),
    /Janela 24h fechada/,
  );
  assert.match(
    p.formatResumeResultAck({ httpStatus: 409, body: { error: 'human_spoke_recently' } }),
    /Recepção falou/,
  );
});
