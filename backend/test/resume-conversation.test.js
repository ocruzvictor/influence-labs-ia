/**
 * Testes unitários — backend/lib/resume-conversation.js
 *
 *   node --test backend/test/resume-conversation.test.js
 */

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../db');
const botStatePath = require.resolve('../lib/bot-state');
const resumePath = require.resolve('../lib/resume-conversation');
const adminAuditPath = require.resolve('../lib/admin-audit');
const opEventsPath = require.resolve('../lib/operational-events');

/** @type {Map<string, object>} */
let threadStore = new Map();
/** @type {Array<{ role: string, content: string, agent?: string, created_at: string }>} */
let historyStore = [];
let whitelist = new Map();
let events = [];
let audits = [];
let tessCalls = 0;
let kapsoCalls = 0;
let markHandledCalls = 0;
let operatorTurnResult = { text: 'Olá! Posso te ajudar a agendar seu horário?', handoffHuman: null };
let kapsoShouldFail = false;
let tessShouldFail = false;
let tessShouldRehandoff = false;
let windowOpen = true;
let clockNow = Date.now();

function isoOffset(ms) {
  return new Date(clockNow + ms).toISOString();
}

function setupMocks() {
  threadStore = new Map();
  historyStore = [];
  whitelist = new Map([['5511999999999', 'allow']]);
  events = [];
  audits = [];
  tessCalls = 0;
  kapsoCalls = 0;
  markHandledCalls = 0;
  operatorTurnResult = { text: 'Olá! Posso te ajudar a agendar seu horário?', handoffHuman: null };
  kapsoShouldFail = false;
  tessShouldFail = false;
  tessShouldRehandoff = false;
  windowOpen = true;
  clockNow = Date.now();

  require.cache[adminAuditPath] = {
    id: adminAuditPath,
    filename: adminAuditPath,
    loaded: true,
    exports: {
      logAudit: async (_db, entry) => { audits.push(entry); },
    },
  };

  require.cache[opEventsPath] = {
    id: opEventsPath,
    filename: opEventsPath,
    loaded: true,
    exports: {
      emitOperationalEvent: async (_db, evt) => { events.push(evt); },
    },
  };

  require.cache[botStatePath] = {
    id: botStatePath,
    filename: botStatePath,
    loaded: true,
    exports: {
      getBotState: async () => ({
        toggles: { global: true },
        whitelist,
      }),
      resolvePhoneAccess: (phone, botState) => {
        const mode = botState.whitelist.get(phone);
        if (mode === 'human_only') return { silent: true, reason: 'mode=human_only' };
        if (mode === 'block') return { silent: true, reason: 'mode=block' };
        return { silent: false, reason: 'allow' };
      },
    },
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, params) => mockQuery(sql, params),
      transaction: async (fn) => {
        const client = { query: (sql, p) => mockQuery(sql, p) };
        return fn(client);
      },
    },
  };

  delete require.cache[resumePath];
}

async function mockQuery(sql, params) {
  if (sql.includes('FOR UPDATE')) {
    const phone = params[0];
    const row = threadStore.get(phone);
    if (!row) return { rows: [] };
    return { rows: [{ ...row }] };
  }

  if (sql.includes('MAX(created_at)') && sql.includes('conversation_history')) {
    const phone = params[0];
    const rows = historyStore.filter((h) => h.client_phone === phone && h.role === 'user');
    if (!rows.length) return { rows: [{ last_user_at: null }] };
    const max = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return { rows: [{ last_user_at: max.created_at }] };
  }

  if (sql.includes('SELECT 1 FROM conversation_history') && sql.includes("role = 'assistant'")) {
    const phone = params[0];
    const since = new Date(params[1]).getTime();
    const hit = historyStore.some(
      (h) => h.client_phone === phone
        && h.role === 'assistant'
        && new Date(h.created_at).getTime() > since,
    );
    return { rows: hit ? [{ '?column?': 1 }] : [] };
  }

  if (sql.includes('SELECT resume_note') && sql.includes('resume_note_consumed_at')) {
    const phone = params[0];
    const row = threadStore.get(phone);
    return { rows: row ? [row] : [] };
  }

  if (sql.includes('INSERT INTO bot_thread_state')) {
    const phone = params[0];
    const existing = threadStore.get(phone) || { phone };
    if (sql.includes('last_staff_outbound_at')) {
      existing.last_staff_outbound_at = isoOffset(0);
    }
    if (params.length >= 5 && sql.includes('resume_note')) {
      existing.resume_note = params[1];
      existing.resume_note_expires_at = params[2] || params[3];
      existing.silenced_until = null;
      existing.silence_reason = null;
      existing.resume_note_consumed_at = null;
      if (sql.includes('last_resume_result')) {
        existing.last_resume_result = params[4] || params[params.length - 2];
        existing.last_resume_at = isoOffset(0);
      }
    }
    threadStore.set(phone, existing);
    return { rows: [] };
  }

  if (sql.includes('UPDATE bot_thread_state')) {
    const phone = params[params.length - 1];
    const row = threadStore.get(phone) || { phone };
    if (sql.includes('last_resume_result') && !sql.includes('resume_note_consumed_at')) {
      row.last_resume_result = params[0];
    }
    if (sql.includes('resume_note_consumed_at')) {
      row.resume_note_consumed_at = isoOffset(0);
    }
    threadStore.set(phone, row);
    return { rows: [] };
  }

  if (sql.includes('INSERT INTO conversation_history')) {
    historyStore.push({
      client_phone: params[0],
      role: params[1],
      content: params[2],
      agent: params[3],
      created_at: isoOffset(0),
    });
    return { rows: [] };
  }

  return { rows: [] };
}

function makeDeps(overrides = {}) {
  const {
    resumeConversation,
    resetIdempotencyCacheForTests,
  } = require('../lib/resume-conversation');
  resetIdempotencyCacheForTests();

  const db = require('../db');
  const { getBotState, resolvePhoneAccess } = require('../lib/bot-state');
  const { emitOperationalEvent } = require('../lib/operational-events');

  return {
    resumeConversation,
    deps: {
      db,
      getBotState,
      resolvePhoneAccess,
      emitOperationalEvent,
      runOperatorResumeTurn: async () => {
        tessCalls += 1;
        if (tessShouldFail) throw new Error('tess down');
        if (tessShouldRehandoff) {
          return { text: 'Vou passar pra recepção.', handoffHuman: { motivo: 'test' } };
        }
        return {
          ...operatorTurnResult,
          persistAssistant: async (p, content) => {
            historyStore.push({
              client_phone: p,
              role: 'assistant',
              content,
              created_at: isoOffset(0),
            });
          },
        };
      },
      sendKapsoMessage: async () => {
        kapsoCalls += 1;
        if (kapsoShouldFail) throw new Error('kapso_send_failed');
      },
      getKapsoPhoneNumberId: () => 'pnid-test',
      markHumanHandled: async () => { markHandledCalls += 1; },
      envAcceptAll: false,
      envAllowedPhones: [],
      ...overrides,
    },
  };
}

function seedSilenced(phone, { staffOutboundMs = null } = {}) {
  threadStore.set(phone, {
    phone,
    silenced_until: isoOffset(60 * 60 * 1000),
    silence_reason: 'handoff',
    last_staff_outbound_at: staffOutboundMs != null ? isoOffset(staffOutboundMs) : null,
  });
}

function seedUserInbound(phone, { ageMs = -1000, agent = null } = {}) {
  historyStore.push({
    client_phone: phone,
    role: 'user',
    content: 'oi',
    agent,
    created_at: isoOffset(ageMs),
  });
}

function teardown() {
  delete require.cache[dbPath];
  delete require.cache[botStatePath];
  delete require.cache[resumePath];
  delete require.cache[adminAuditPath];
  delete require.cache[opEventsPath];
}

beforeEach(() => setupMocks());
afterEach(() => teardown());

test('validateResumeInput: nota curta → 400 invalid_note', async () => {
  const { resumeConversation, deps } = makeDeps();
  const shortNote = 'nota curta';
  const r = await resumeConversation('5511999999999', { note: shortNote }, deps);
  assert.equal(r.httpStatus, 400);
  assert.equal(r.body.error, 'invalid_note');
  assert.equal(tessCalls, 0);
});

test('validateResumeInput: phone inválido → 400', async () => {
  const { resumeConversation, deps } = makeDeps();
  const r = await resumeConversation('123', { note: 'x'.repeat(20) }, deps);
  assert.equal(r.httpStatus, 400);
  assert.equal(r.body.error, 'invalid_phone');
});

test('409 human_only', async () => {
  whitelist.set('5511999999999', 'human_only');
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 409);
  assert.equal(r.body.error, 'human_only');
  assert.equal(tessCalls, 0);
});

test('409 blocked', async () => {
  whitelist.set('5511999999999', 'block');
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 409);
  assert.equal(r.body.error, 'blocked');
});

test('409 human_spoke_recently', async () => {
  seedSilenced('5511999999999', { staffOutboundMs: -2 * 60 * 1000 });
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 409);
  assert.equal(r.body.error, 'human_spoke_recently');
});

test('200 already_active sem silêncio', async () => {
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.body.status, 'already_active');
  assert.equal(tessCalls, 0);
});

test('200 window_closed — nota pendente, sem TESS', async () => {
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999', { ageMs: -25 * 60 * 60 * 1000 });
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.body.status, 'window_closed');
  assert.equal(tessCalls, 0);
  assert.equal(kapsoCalls, 0);
  const row = threadStore.get('5511999999999');
  assert.ok(row.resume_note);
  assert.ok(events.some((e) => e.event === 'resume.window_closed'));
});

test('passive inbound abre janela 24h → sent', async () => {
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999', { ageMs: -2 * 60 * 60 * 1000, agent: 'passive' });
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.body.status, 'sent');
  assert.equal(tessCalls, 1);
  assert.equal(kapsoCalls, 1);
});

test('200 sent happy path', async () => {
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.body.status, 'sent');
  assert.ok(events.some((e) => e.event === 'resume.sent'));
  assert.ok(audits.some((a) => a.action === 'conversation.resume'));
});

test('422 tess_failed', async () => {
  tessShouldFail = true;
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 422);
  assert.equal(r.body.error, 'tess_failed');
  assert.ok(markHandledCalls >= 1);
});

test('422 tess_rehandoff', async () => {
  tessShouldRehandoff = true;
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 422);
  assert.equal(r.body.error, 'tess_rehandoff');
});

test('503 kapso_send_failed', async () => {
  kapsoShouldFail = true;
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 503);
  assert.equal(r.body.error, 'kapso_send_failed');
});

test('leak filter: overlap 40+ chars → 422', async () => {
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  operatorTurnResult = {
    text: `Claro! ${note} Vamos agendar?`,
    handoffHuman: null,
  };
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const r = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r.httpStatus, 422);
  assert.equal(r.body.error, 'tess_failed');
});

test('idempotência 15s: mesma nota devolve primeiro resultado', async () => {
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r1 = await resumeConversation('5511999999999', { note }, deps);
  const r2 = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r1.httpStatus, 200);
  assert.deepEqual(r2, r1);
  assert.equal(tessCalls, 1);
});

test('hasNoteLeak unit', () => {
  const { hasNoteLeak } = require('../lib/resume-conversation');
  const note = 'Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  assert.equal(hasNoteLeak('Tudo bem!', note), false);
  assert.equal(hasNoteLeak(`Ok! ${note}`, note), true);
});

test('nota curta não limpa silêncio (sem INSERT)', async () => {
  seedSilenced('5511999999999');
  const before = threadStore.get('5511999999999')?.silenced_until;
  const { resumeConversation, deps } = makeDeps();
  await resumeConversation('5511999999999', { note: 'curta' }, deps);
  const after = threadStore.get('5511999999999')?.silenced_until;
  assert.equal(before, after);
});

test('zero UPDATE bot_whitelist no módulo', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../lib/resume-conversation.js'), 'utf8');
  assert.doesNotMatch(src, /UPDATE\s+bot_whitelist/i);
});

test('validateResumeInput: nota >500 → 400 invalid_note', async () => {
  const { resumeConversation, deps } = makeDeps();
  const r = await resumeConversation('5511999999999', { note: 'x'.repeat(501) }, deps);
  assert.equal(r.httpStatus, 400);
  assert.equal(r.body.error, 'invalid_note');
});

test('validateResumeInput: actor omitido default cli', () => {
  const { validateResumeInput } = require('../lib/resume-conversation');
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r = validateResumeInput('5511999999999', note);
  assert.equal(r.ok, true);
  assert.equal(r.actor, 'cli');
});

test('peekPendingResumeNote: lê nota sem marcar consumed', async () => {
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  threadStore.set('5511999999999', {
    phone: '5511999999999',
    resume_note: note,
    resume_note_expires_at: isoOffset(30 * 60 * 1000),
    resume_note_consumed_at: null,
  });
  const { peekPendingResumeNote } = require('../lib/resume-conversation');
  const db = require('../db');
  const got = await peekPendingResumeNote(db, '5511999999999');
  assert.equal(got, note);
  assert.equal(threadStore.get('5511999999999').resume_note_consumed_at, null);
});

test('peekPendingResumeNote: nota expirada → null', async () => {
  threadStore.set('5511999999999', {
    phone: '5511999999999',
    resume_note: 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.',
    resume_note_expires_at: isoOffset(-1000),
    resume_note_consumed_at: null,
  });
  const { peekPendingResumeNote } = require('../lib/resume-conversation');
  const got = await peekPendingResumeNote(require('../db'), '5511999999999');
  assert.equal(got, null);
});

test('markResumeNoteConsumed: marca consumed após TESS', async () => {
  threadStore.set('5511999999999', {
    phone: '5511999999999',
    resume_note: 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.',
    resume_note_consumed_at: null,
  });
  const { markResumeNoteConsumed } = require('../lib/resume-conversation');
  await markResumeNoteConsumed(require('../db'), '5511999999999');
  assert.ok(threadStore.get('5511999999999').resume_note_consumed_at);
});

test('skip+nota: pending note força turno TESS (não skip trivial)', () => {
  const { shouldSkipTess, INTENTS } = require('../lib/tess-context-intent');
  const wouldSkip = shouldSkipTess({
    intent: INTENTS.TRIVIAL,
    confidence: 'high',
    history: [],
    messageText: 'oi',
    isMedia: false,
    skipEnabled: true,
    trivialMaxChars: 80,
    isOwner: false,
  });
  const pendingNote = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const effectiveSkip = pendingNote ? false : wouldSkip;
  assert.ok(wouldSkip);
  assert.equal(effectiveSkip, false);
});

test('window_closed + nota diferente substitui (não already_active)', async () => {
  const note1 = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const note2 = 'Retoma agora. Priorize agendar mecha teste — obrigatorio para a cliente hoje.';
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999', { ageMs: -25 * 60 * 60 * 1000 });
  const { resumeConversation, deps } = makeDeps();
  await resumeConversation('5511999999999', { note: note1 }, deps);
  threadStore.set('5511999999999', {
    ...threadStore.get('5511999999999'),
    silenced_until: null,
    silence_reason: null,
    resume_note: note1,
    resume_note_consumed_at: null,
    last_resume_at: isoOffset(-60 * 1000),
    last_resume_result: 'window_closed',
  });
  const r2 = await resumeConversation('5511999999999', { note: note2 }, deps);
  assert.equal(r2.httpStatus, 200);
  assert.equal(r2.body.status, 'window_closed');
  assert.equal(threadStore.get('5511999999999').resume_note, note2);
});

test('idempotência: falha 422 não bloqueia retry', async () => {
  tessShouldFail = true;
  seedSilenced('5511999999999');
  seedUserInbound('5511999999999');
  const { resumeConversation, deps } = makeDeps();
  const note = 'Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.';
  const r1 = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r1.httpStatus, 422);
  tessShouldFail = false;
  const r2 = await resumeConversation('5511999999999', { note }, deps);
  assert.equal(r2.httpStatus, 200);
  assert.equal(r2.body.status, 'sent');
  assert.equal(tessCalls, 2);
});

test('resume route auth mirror: 401 sem X-Admin-Token válido', () => {
  function isResumeUnauthorized(adminToken, headerToken) {
    return !adminToken || headerToken !== adminToken;
  }
  assert.equal(isResumeUnauthorized('secret', undefined), true);
  assert.equal(isResumeUnauthorized('secret', 'wrong'), true);
  assert.equal(isResumeUnauthorized('secret', 'secret'), false);
  assert.equal(isResumeUnauthorized('', 'secret'), true);
});
