/**
 * Martelo — receipt nomeado (story redesenho-2). 0 LLM.
 * Approve não POST Trinks; só libera o gate COMMITTING.
 */

const { digitsOnly } = require('./owner-access');
const { emitOperationalEvent } = require('./operational-events');
const { last4, lookupActiveHoldForPhone, markRejected } = require('./booking-holds');

const PENDING_ASSIGNED = 'queue:owner';
const REJECT_COPY = 'Esse horário não ficou gravado. Quer outro?';

const GENERIC_ASSIGNED = new Set([
  'recepção',
  'recepcao',
  'a recepção',
  'staff',
]);

function handoffSlaSeconds(env = process.env) {
  const raw = Number(env.BOOKING_HANDOFF_SLA_SEC);
  const n = Number.isFinite(raw) ? raw : 900;
  return Math.min(3600, Math.max(300, n));
}

function isGenericAssigned(value) {
  return GENERIC_ASSIGNED.has(String(value || '').trim().toLowerCase());
}

function isNamedAssignee(value) {
  const t = String(value || '').trim();
  if (!t || isGenericAssigned(t)) return false;
  if (t.toLowerCase() === PENDING_ASSIGNED) return false;
  return t.length >= 2;
}

function emitReceipt(db, { phone, receiptId, action, motivo }) {
  emitOperationalEvent(db, {
    event: 'handoff.receipt',
    clientPhone: phone,
    motivo: motivo || action,
    payload: {
      last4: last4(phone),
      receiptId,
      action,
    },
  }).catch(() => {});
}

async function timeoutStale(db, { emit = true } = {}) {
  if (!db) return [];
  const result = await db.query(
    `UPDATE booking_handoff_receipts
        SET action = 'timeout'
      WHERE action = 'pending'
        AND sla_until <= NOW()
      RETURNING id, phone, hold_id, action`,
  );
  const rows = result.rows || [];
  if (emit) {
    for (const row of rows) {
      emitReceipt(db, {
        phone: row.phone,
        receiptId: row.id,
        action: 'timeout',
        motivo: 'timeout',
      });
    }
  }
  return rows;
}

async function lookupLatestForHold(db, holdId) {
  if (!db || !holdId) return null;
  const result = await db.query(
    `SELECT id, hold_id, phone, assigned_to, sla_until, action, acted_at, note
       FROM booking_handoff_receipts
      WHERE hold_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [holdId],
  );
  return result.rows[0] || null;
}

async function ensurePending(db, { holdId, phone } = {}) {
  const digits = digitsOnly(phone);
  if (!db || !holdId || !digits) return { ok: false, reason: 'incomplete' };

  try {
    await timeoutStale(db);

    const latest = await lookupLatestForHold(db, holdId);
    if (latest && (latest.action === 'pending' || latest.action === 'approved')) {
      return { ok: true, receipt: latest, reused: true };
    }

    const sla = handoffSlaSeconds();
    const inserted = await db.query(
      `INSERT INTO booking_handoff_receipts
         (hold_id, phone, assigned_to, sla_until, action)
       VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 second'), 'pending')
       ON CONFLICT (hold_id) WHERE action = 'pending' AND hold_id IS NOT NULL
       DO NOTHING
       RETURNING id, hold_id, phone, assigned_to, sla_until, action, acted_at, note`,
      [holdId, digits, PENDING_ASSIGNED, sla],
    );

    if (inserted.rows[0]) {
      const receipt = inserted.rows[0];
      emitReceipt(db, {
        phone: digits,
        receiptId: receipt.id,
        action: 'pending',
        motivo: 'pending',
      });
      return { ok: true, receipt, reused: false };
    }

    const again = await lookupLatestForHold(db, holdId);
    if (again) return { ok: true, receipt: again, reused: true };
    return { ok: false, reason: 'conflict' };
  } catch (err) {
    return { ok: false, reason: 'unavailable' };
  }
}

async function canCommit(db, holdId) {
  if (!db || !holdId) return { ok: false, canCommit: false, reason: 'incomplete' };
  await timeoutStale(db);
  const latest = await lookupLatestForHold(db, holdId);
  if (latest && latest.action === 'approved') {
    return { ok: true, canCommit: true, receipt: latest };
  }
  return { ok: true, canCommit: false, receipt: latest || null };
}

async function actOnReceipt(db, receiptId, { action, assignedTo, note } = {}) {
  if (!db || !receiptId) return { ok: false, reason: 'incomplete' };
  if (action !== 'approved' && action !== 'rejected') {
    return { ok: false, reason: 'invalid_action' };
  }
  if (!isNamedAssignee(assignedTo)) {
    return { ok: false, reason: 'assigned_to' };
  }

  await timeoutStale(db);
  const current = await db.query(
    `SELECT id, hold_id, phone, action
       FROM booking_handoff_receipts
      WHERE id = $1`,
    [receiptId],
  );
  const row = current.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.action !== 'pending') return { ok: false, reason: 'not_pending', receipt: row };

  const updated = await db.query(
    `UPDATE booking_handoff_receipts
        SET action = $2,
            assigned_to = $3,
            acted_at = NOW(),
            note = $4
      WHERE id = $1 AND action = 'pending'
      RETURNING id, hold_id, phone, assigned_to, sla_until, action, acted_at, note`,
    [receiptId, action, String(assignedTo).trim(), note || null],
  );
  const receipt = updated.rows[0];
  if (!receipt) return { ok: false, reason: 'not_pending' };

  if (action === 'rejected' && receipt.hold_id) {
    await markRejected(db, receipt.hold_id);
  }

  emitReceipt(db, {
    phone: receipt.phone,
    receiptId: receipt.id,
    action,
    motivo: action,
  });
  return { ok: true, receipt };
}

async function captureForPhone(db, phone) {
  const hold = await lookupActiveHoldForPhone(db, phone);
  if (!hold) return { ok: true, receipt: null, hold: null };
  const pending = await ensurePending(db, { holdId: hold.id, phone });
  return { ...pending, hold };
}

async function gateCommit(db, { holdId, phone, required }) {
  if (!required) return { ok: true, canCommit: true, receipt: null };
  if (!holdId) {
    const captured = await captureForPhone(db, phone);
    if (!captured.hold) return { ok: true, canCommit: false, reason: 'no_hold', receipt: null };
    holdId = captured.hold.id;
  } else {
    await ensurePending(db, { holdId, phone });
  }
  return canCommit(db, holdId);
}

module.exports = {
  PENDING_ASSIGNED,
  REJECT_COPY,
  GENERIC_ASSIGNED,
  handoffSlaSeconds,
  isGenericAssigned,
  isNamedAssignee,
  timeoutStale,
  lookupLatestForHold,
  ensurePending,
  canCommit,
  actOnReceipt,
  captureForPhone,
  gateCommit,
};
