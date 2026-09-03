/**
 * resume-conversation — POST /admin/conversations/:phone/resume (story resume-ia-2/6).
 *
 * Fonte da verdade: limpa silêncio handoff, injeta ORIENTACAO_OPERADOR, envia TESS+Kapso
 * na janela 24h. Muta bot_whitelist SOMENTE mode='human_only' após sucesso (sent/window_closed).
 * Nunca persiste nota como role=user da cliente.
 */

const crypto = require('crypto');
const { digitsOnly } = require('./owner-access');
const { logAudit } = require('./admin-audit');
const { invalidatePhoneCache } = require('./bot-thread-state');

const NOTE_MIN = 20;
const NOTE_MAX = 500;
const IDEMPOTENCY_TTL_MS = 15_000;
const STAFF_SPOKE_WINDOW_MS = 10 * 60 * 1000;
const PENDING_NOTE_TTL_MS = 30 * 60 * 1000;
const LEAK_MIN_CHARS = 40;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const VALID_ACTORS = new Set(['cli', 'admin', 'whatsapp']);

const OPERATOR_RESUME_TRIGGER =
  'Retome o atendimento proativamente conforme ORIENTACAO_OPERADOR acima. Fale diretamente com a cliente.';

/** @type {Map<string, { result: object, at: number }>} */
const idempotencyCache = new Map();

function resetIdempotencyCacheForTests() {
  idempotencyCache.clear();
}

function normalizeNote(note) {
  return String(note || '').trim().replace(/\s+/g, ' ');
}

function hashNote(note) {
  return crypto.createHash('sha256').update(normalizeNote(note)).digest('hex').slice(0, 32);
}

function idempotencyKey(phone, note, force = false) {
  return `${phone}:${hashNote(note)}:${force ? '1' : '0'}`;
}

function getCachedIdempotentResult(phone, note, force = false) {
  const key = idempotencyKey(phone, note, force);
  const entry = idempotencyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return null;
  }
  return entry.result;
}

function shouldCacheIdempotentResult(result) {
  return result?.httpStatus === 200
    && ['sent', 'window_closed', 'already_active'].includes(result?.body?.status);
}

function cacheIdempotentResult(phone, note, force, result) {
  if (!shouldCacheIdempotentResult(result)) return;
  idempotencyCache.set(idempotencyKey(phone, note, force), { result, at: Date.now() });
}

/**
 * @param {string} phone
 * @param {string} note
 * @param {string} [actor]
 * @param {boolean|undefined|null} [force]
 * @returns {{ ok: true, phone: string, note: string, actor: string, force: boolean } | { ok: false, status: number, error: string }}
 */
function validateResumeInput(phone, note, actor = 'cli', force) {
  const digits = digitsOnly(phone);
  if (!digits || digits.length < 10 || digits.length > 15) {
    return { ok: false, status: 400, error: 'invalid_phone' };
  }

  const normalized = normalizeNote(note);
  if (normalized.length < NOTE_MIN || normalized.length > NOTE_MAX) {
    return { ok: false, status: 400, error: 'invalid_note' };
  }

  const safeActor = actor == null || actor === '' ? 'cli' : String(actor);
  if (!VALID_ACTORS.has(safeActor)) {
    return { ok: false, status: 400, error: 'invalid_actor' };
  }

  let safeForce = false;
  if (force === undefined || force === null || force === false) {
    safeForce = false;
  } else if (force === true) {
    safeForce = true;
  } else {
    return { ok: false, status: 400, error: 'invalid_force' };
  }

  return { ok: true, phone: digits, note: normalized, actor: safeActor, force: safeForce };
}

/**
 * @param {{ silenced: boolean, wasHumanOnly: boolean }} ctx
 * @returns {'handoff_silence'|'unpause'|'expired'}
 */
function resolveResumeKind({ silenced, wasHumanOnly }) {
  if (silenced) return 'handoff_silence';
  if (wasHumanOnly) return 'unpause';
  return 'expired';
}

/**
 * Limpa human_only da whitelist após sucesso de retomada.
 *
 * @param {object} db
 * @param {string} phone
 * @param {object} deps
 * @returns {Promise<boolean>} true se UPDATE afetou row human_only
 */
async function clearHumanOnly(db, phone, deps) {
  const result = await db.query(
    `UPDATE bot_whitelist SET mode='allow' WHERE phone=$1 AND mode='human_only'`,
    [phone],
  );
  const cleared = (result?.rowCount ?? 0) > 0;
  const invalidateBotStateCache = deps.invalidateCache
    || require('./bot-state').invalidateCache;
  invalidateBotStateCache();
  invalidatePhoneCache(phone);
  return cleared;
}

/**
 * Filtro leak: 40+ chars contínuos da nota aparecem na fala TESS.
 *
 * @param {string} tessText
 * @param {string} note
 * @param {number} [minLen]
 * @returns {boolean}
 */
function hasNoteLeak(tessText, note, minLen = LEAK_MIN_CHARS) {
  const normalizedNote = normalizeNote(note).toLowerCase();
  const normalizedText = String(tessText || '').toLowerCase();
  if (normalizedNote.length < minLen) return false;
  for (let i = 0; i <= normalizedNote.length - minLen; i += 1) {
    const chunk = normalizedNote.slice(i, i + minLen);
    if (normalizedText.includes(chunk)) return true;
  }
  return false;
}

/**
 * @param {import('pg').PoolClient | { query: Function }} client
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
async function lockThreadState(client, phone) {
  const result = await client.query(
    `SELECT phone, silenced_until, silence_reason, last_staff_outbound_at,
            resume_note, resume_note_expires_at, resume_note_consumed_at
       FROM bot_thread_state
      WHERE phone = $1
      FOR UPDATE`,
    [phone],
  );
  return result?.rows?.[0] || null;
}

/**
 * Janela Meta 24h — inclui agent='passive'.
 *
 * @param {object} db
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
async function is24hWindowOpen(db, phone) {
  const result = await db.query(
    `SELECT MAX(created_at) AS last_user_at
       FROM conversation_history
      WHERE client_phone = $1 AND role = 'user'`,
    [phone],
  );
  if (!result?.rows?.[0]?.last_user_at) return false;
  const lastAt = new Date(result.rows[0].last_user_at).getTime();
  return Date.now() - lastAt < WINDOW_MS;
}

function isSilencedActive(silencedUntil) {
  if (!silencedUntil) return false;
  return Date.now() < new Date(silencedUntil).getTime();
}

function staffSpokeRecently(lastStaffOutboundAt) {
  if (!lastStaffOutboundAt) return false;
  return Date.now() - new Date(lastStaffOutboundAt).getTime() < STAFF_SPOKE_WINDOW_MS;
}

/**
 * Nota pendente válida (window_closed ou consume-on-inbound).
 *
 * @param {object|null} row
 * @returns {string|null}
 */
function getValidPendingNote(row) {
  if (!row?.resume_note || row.resume_note_consumed_at) return null;
  if (row.resume_note_expires_at && new Date(row.resume_note_expires_at).getTime() < Date.now()) {
    return null;
  }
  return String(row.resume_note);
}

/**
 * Consume-on-inbound: lê nota pendente sem marcar consumed (TTL 30 min no read).
 *
 * @param {object} db
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
async function peekPendingResumeNote(db, phone) {
  const digits = digitsOnly(phone);
  if (!digits) return null;

  const result = await db.query(
    `SELECT resume_note, resume_note_expires_at, resume_note_consumed_at
       FROM bot_thread_state
      WHERE phone = $1`,
    [digits],
  );
  const row = result?.rows?.[0];
  return getValidPendingNote(row);
}

/**
 * Marca nota pendente como consumida após turno TESS bem-sucedido.
 *
 * @param {object} db
 * @param {string} phone
 * @returns {Promise<void>}
 */
async function markResumeNoteConsumed(db, phone) {
  const digits = digitsOnly(phone);
  if (!digits) return;

  invalidatePhoneCache(digits);
  await db.query(
    `UPDATE bot_thread_state
        SET resume_note_consumed_at = NOW(),
            updated_at = NOW()
      WHERE phone = $1
        AND resume_note IS NOT NULL
        AND resume_note_consumed_at IS NULL`,
    [digits],
  );
}

/**
 * @deprecated Use peekPendingResumeNote + markResumeNoteConsumed
 * @param {object} db
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
async function consumePendingResumeNote(db, phone) {
  return peekPendingResumeNote(db, phone);
}

/**
 * Houve outbound assistant (cloud_api persistido) desde o último resume?
 *
 * @param {object} db
 * @param {string} phone
 * @param {string|Date|null} sinceAt
 * @returns {Promise<boolean>}
 */
async function hadAssistantOutboundSince(db, phone, sinceAt) {
  if (!sinceAt) return false;
  const result = await db.query(
    `SELECT 1 FROM conversation_history
      WHERE client_phone = $1 AND role = 'assistant' AND created_at > $2
      LIMIT 1`,
    [phone, sinceAt],
  );
  return Boolean(result?.rows?.length);
}

/**
 * Persiste/atualiza nota pendente (window_closed ou replace sem send proativo).
 *
 * @param {object} db
 * @param {string} phone
 * @param {object} fields
 * @returns {Promise<void>}
 */
async function persistPendingResumeNote(db, phone, {
  note, expiresAt, actor, noteHash, resultStatus = 'window_closed',
}) {
  invalidatePhoneCache(phone);
  await db.query(
    `INSERT INTO bot_thread_state (phone, silenced_until, silence_reason,
          resume_note, resume_note_set_at, resume_note_expires_at, resume_note_consumed_at,
          last_resume_at, last_resume_actor, last_resume_result, last_resume_note_hash)
     VALUES ($1, NULL, NULL, $2, NOW(), $3, NULL, NOW(), $4, $5, $6)
     ON CONFLICT (phone) DO UPDATE SET
       silenced_until = NULL,
       silence_reason = NULL,
       resume_note = EXCLUDED.resume_note,
       resume_note_set_at = NOW(),
       resume_note_expires_at = EXCLUDED.resume_note_expires_at,
       resume_note_consumed_at = NULL,
       last_resume_at = NOW(),
       last_resume_actor = EXCLUDED.last_resume_actor,
       last_resume_result = EXCLUDED.last_resume_result,
       last_resume_note_hash = EXCLUDED.last_resume_note_hash`,
    [phone, note, expiresAt.toISOString(), actor, resultStatus, noteHash],
  );
}

/**
 * @param {string} phone
 * @param {{ note: string, actor?: string, force?: boolean }} opts
 * @param {object} deps
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
async function resumeConversation(phone, { note, actor = 'cli', force = false }, deps) {
  const {
    db,
    getBotState,
    resolvePhoneAccess,
    emitOperationalEvent,
    runOperatorResumeTurn,
    sendKapsoMessage,
    getKapsoPhoneNumberId,
    markHumanHandled,
    envAcceptAll = false,
    envAllowedPhones = [],
  } = deps;

  const validated = validateResumeInput(phone, note, actor, force);
  if (!validated.ok) {
    return { httpStatus: validated.status, body: { error: validated.error } };
  }

  const { phone: digits, note: normalizedNote, actor: safeActor } = validated;
  const effectiveForce = safeActor === 'whatsapp' ? false : validated.force;
  const noteHash = hashNote(normalizedNote);

  const cached = getCachedIdempotentResult(digits, normalizedNote, effectiveForce);
  if (cached) return cached;

  await emitOperationalEvent(db, {
    event: 'resume.requested',
    clientPhone: digits,
    motivo: `actor=${safeActor}`,
    payload: {
      actor: safeActor,
      note_hash: noteHash,
      note_length: normalizedNote.length,
      force: effectiveForce,
    },
  });

  const botState = await getBotState();
  const access = resolvePhoneAccess(digits, botState, {
    acceptAll: envAcceptAll,
    allowedPhones: envAllowedPhones,
  });
  const wasHumanOnly = access.reason === 'mode=human_only';

  if (wasHumanOnly && !effectiveForce) {
    const out = { httpStatus: 409, body: { error: 'human_only' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'human_only',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }
  if (access.reason === 'mode=block') {
    const out = { httpStatus: 409, body: { error: 'blocked' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'blocked',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }

  if (!db.transaction) {
    return { httpStatus: 503, body: { error: 'db_unavailable' } };
  }

  let threadRow = null;
  try {
    threadRow = await db.transaction(async (client) => {
      const existing = await lockThreadState(client, digits);
      const staffAt = existing?.last_staff_outbound_at;
      if (staffSpokeRecently(staffAt)) {
        const err = new Error('human_spoke_recently');
        err.code = 'human_spoke_recently';
        throw err;
      }

      const silenced = isSilencedActive(existing?.silenced_until);
      const pendingNote = getValidPendingNote(existing);
      if (!silenced && !pendingNote && !effectiveForce) {
        const err = new Error('already_active');
        err.code = 'already_active';
        throw err;
      }

      return existing;
    });
  } catch (err) {
    if (err.code === 'human_spoke_recently') {
      const out = { httpStatus: 409, body: { error: 'human_spoke_recently' } };
      await emitOperationalEvent(db, {
        event: 'resume.failed',
        clientPhone: digits,
        motivo: 'human_spoke_recently',
        payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
      });
      return out;
    }
    if (err.code === 'already_active') {
      const out = { httpStatus: 200, body: { status: 'already_active' } };
      await logAudit(db, {
        action: 'conversation.resume',
        userId: null,
        targetType: 'conversation',
        targetId: digits,
        payload: {
          actor: safeActor,
          result: 'already_active',
          note_hash: noteHash,
          force: effectiveForce,
        },
      });
      cacheIdempotentResult(digits, normalizedNote, effectiveForce, out);
      return out;
    }
    console.error('[resume] transaction pre-check failed:', err.message);
    return { httpStatus: 503, body: { error: 'db_error' } };
  }

  const windowOpen = await is24hWindowOpen(db, digits);
  const expiresAt = new Date(Date.now() + PENDING_NOTE_TTL_MS);
  const pendingNote = getValidPendingNote(threadRow);
  const silenced = isSilencedActive(threadRow?.silenced_until);
  const resumeKind = resolveResumeKind({ silenced, wasHumanOnly });
  const outboundSinceResume = await hadAssistantOutboundSince(db, digits, threadRow?.last_resume_at);
  const canProactiveSend = windowOpen && (silenced || !pendingNote || !outboundSinceResume || effectiveForce);

  if (!canProactiveSend) {
    await persistPendingResumeNote(db, digits, {
      note: normalizedNote,
      expiresAt,
      actor: safeActor,
      noteHash,
      resultStatus: 'window_closed',
    });

    let clearedHumanOnly = false;
    if (wasHumanOnly) {
      clearedHumanOnly = await clearHumanOnly(db, digits, deps);
    }

    const out = { httpStatus: 200, body: { status: 'window_closed' } };
    await emitOperationalEvent(db, {
      event: 'resume.window_closed',
      clientPhone: digits,
      motivo: `actor=${safeActor}`,
      payload: {
        actor: safeActor,
        note_hash: noteHash,
        note_length: normalizedNote.length,
        force: effectiveForce,
        kind: resumeKind,
        cleared_human_only: clearedHumanOnly,
      },
    });
    await logAudit(db, {
      action: 'conversation.resume',
      userId: null,
      targetType: 'conversation',
      targetId: digits,
      payload: {
        actor: safeActor,
        result: 'window_closed',
        note_hash: noteHash,
        force: effectiveForce,
        kind: resumeKind,
        cleared_human_only: clearedHumanOnly,
      },
    });
    cacheIdempotentResult(digits, normalizedNote, effectiveForce, out);
    return out;
  }

  invalidatePhoneCache(digits);
  await db.query(
    `INSERT INTO bot_thread_state (phone, silenced_until, silence_reason,
          resume_note, resume_note_set_at, resume_note_expires_at,
          last_resume_at, last_resume_actor, last_resume_result, last_resume_note_hash)
     VALUES ($1, NULL, NULL, $2, NOW(), $3, NOW(), $4, 'pending_send', $5)
     ON CONFLICT (phone) DO UPDATE SET
       silenced_until = NULL,
       silence_reason = NULL,
       resume_note = EXCLUDED.resume_note,
       resume_note_set_at = NOW(),
       resume_note_expires_at = EXCLUDED.resume_note_expires_at,
       last_resume_at = NOW(),
       last_resume_actor = EXCLUDED.last_resume_actor,
       last_resume_result = 'pending_send',
       last_resume_note_hash = EXCLUDED.last_resume_note_hash`,
    [digits, normalizedNote, expiresAt.toISOString(), safeActor, noteHash],
  );

  let turnResult;
  try {
    turnResult = await runOperatorResumeTurn(digits, normalizedNote);
  } catch (err) {
    console.error('[resume] TESS turn failed:', err.message);
    await markHumanHandled(digits, 'handoff');
    invalidatePhoneCache(digits);
    await db.query(
      `UPDATE bot_thread_state SET last_resume_result = 'tess_failed' WHERE phone = $1`,
      [digits],
    );
    const out = { httpStatus: 422, body: { error: 'tess_failed' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'tess_failed',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }

  if (!turnResult?.text) {
    await markHumanHandled(digits, 'handoff');
    invalidatePhoneCache(digits);
    const out = { httpStatus: 422, body: { error: 'tess_failed' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'tess_failed',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }

  if (turnResult.handoffHuman) {
    await markHumanHandled(digits, 'handoff');
    invalidatePhoneCache(digits);
    await db.query(
      `UPDATE bot_thread_state SET last_resume_result = 'tess_rehandoff' WHERE phone = $1`,
      [digits],
    );
    const out = { httpStatus: 422, body: { error: 'tess_rehandoff' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'tess_rehandoff',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce, handoff: turnResult.handoffHuman.motivo },
    });
    return out;
  }

  if (hasNoteLeak(turnResult.text, normalizedNote)) {
    await markHumanHandled(digits, 'handoff');
    invalidatePhoneCache(digits);
    await db.query(
      `UPDATE bot_thread_state SET last_resume_result = 'note_leak' WHERE phone = $1`,
      [digits],
    );
    const out = { httpStatus: 422, body: { error: 'tess_failed' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'note_leak',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }

  const phoneNumberId = getKapsoPhoneNumberId();
  try {
    await sendKapsoMessage(digits, turnResult.text, phoneNumberId);
  } catch (err) {
    console.error('[resume] Kapso send failed:', err.message);
    await markHumanHandled(digits, 'handoff');
    invalidatePhoneCache(digits);
    const out = { httpStatus: 503, body: { error: 'kapso_send_failed' } };
    await emitOperationalEvent(db, {
      event: 'resume.failed',
      clientPhone: digits,
      motivo: 'kapso_send_failed',
      payload: { actor: safeActor, note_hash: noteHash, force: effectiveForce },
    });
    return out;
  }

  if (turnResult.persistAssistant) {
    await turnResult.persistAssistant(digits, turnResult.text);
  }

  let clearedHumanOnly = false;
  if (wasHumanOnly) {
    clearedHumanOnly = await clearHumanOnly(db, digits, deps);
  }

  invalidatePhoneCache(digits);
  await db.query(
    `UPDATE bot_thread_state
        SET last_resume_result = 'sent',
            resume_note_consumed_at = NOW()
      WHERE phone = $1`,
    [digits],
  );

  const out = { httpStatus: 200, body: { status: 'sent' } };
  await emitOperationalEvent(db, {
    event: 'resume.sent',
    clientPhone: digits,
    motivo: `actor=${safeActor}`,
    payload: {
      actor: safeActor,
      note_hash: noteHash,
      source: 'operator_resume',
      force: effectiveForce,
      kind: resumeKind,
      cleared_human_only: clearedHumanOnly,
    },
  });
  await logAudit(db, {
    action: 'conversation.resume',
    userId: null,
    targetType: 'conversation',
    targetId: digits,
    payload: {
      actor: safeActor,
      result: 'sent',
      note_hash: noteHash,
      force: effectiveForce,
      kind: resumeKind,
      cleared_human_only: clearedHumanOnly,
    },
  });
  cacheIdempotentResult(digits, normalizedNote, effectiveForce, out);
  return out;
}

module.exports = {
  NOTE_MIN,
  NOTE_MAX,
  IDEMPOTENCY_TTL_MS,
  STAFF_SPOKE_WINDOW_MS,
  LEAK_MIN_CHARS,
  OPERATOR_RESUME_TRIGGER,
  resetIdempotencyCacheForTests,
  normalizeNote,
  hashNote,
  idempotencyKey,
  validateResumeInput,
  hasNoteLeak,
  is24hWindowOpen,
  peekPendingResumeNote,
  markResumeNoteConsumed,
  consumePendingResumeNote,
  getValidPendingNote,
  hadAssistantOutboundSince,
  shouldCacheIdempotentResult,
  resolveResumeKind,
  clearHumanOnly,
  resumeConversation,
};
