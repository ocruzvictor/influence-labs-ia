/**
 * Soft-lock local de slot (story redesenho-1). 0 LLM. Hold ≠ commit Trinks.
 */

const { digitsOnly } = require('./owner-access');
const { emitOperationalEvent } = require('./operational-events');

const SLOT_UNAVAILABLE_COPY =
  'Esse horário acabou de ficar indisponível. Me passa outro que eu te ajudo.';

const HELD_COPY_RE =
  /^\d{1,2}h(?:\d{2})? está separado por \d+ min\. Só vale quando eu confirmar o agendamento\.$/;

function holdTtlSeconds(env = process.env) {
  const raw = Number(env.BOOKING_HOLD_TTL_SEC);
  const n = Number.isFinite(raw) ? raw : 180;
  return Math.min(300, Math.max(120, n));
}

function last4(phone) {
  const d = digitsOnly(phone);
  return d ? d.slice(-4) : '';
}

function formatHeldCopy(slotStart, ttlSec = holdTtlSeconds()) {
  const d = slotStart instanceof Date ? slotStart : new Date(slotStart);
  if (Number.isNaN(d.getTime())) {
    return `Esse horário está separado por ${ttlSec} min. Só vale quando eu confirmar o agendamento.`;
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = d.getMinutes();
  const label = mm === 0 ? `${Number(hh)}h` : `${Number(hh)}h${String(mm).padStart(2, '0')}`;
  return `${label} está separado por ${ttlSec} min. Só vale quando eu confirmar o agendamento.`;
}

function isHeldAllowlistCopy(text) {
  return HELD_COPY_RE.test(String(text || '').trim());
}

function parseSlotStart(dateTime) {
  if (!dateTime) return null;
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isActiveStatus(status) {
  return status === 'held' || status === 'committing';
}

async function expireStale(db, { emit = true } = {}) {
  if (!db) return [];
  const result = await db.query(
    `UPDATE booking_holds
        SET status = 'expired', updated_at = NOW()
      WHERE status = 'held'
        AND expires_at <= NOW()
      RETURNING id, phone`,
  );
  const rows = result.rows || [];
  if (emit) {
    for (const row of rows) {
      emitOperationalEvent(db, {
        event: 'hold.expired',
        clientPhone: row.phone,
        motivo: 'ttl',
        payload: { last4: last4(row.phone), holdId: row.id },
      }).catch(() => {});
    }
  }
  return rows;
}

async function lookupActiveForPhoneSlot(db, { phone, profissionalId, slotStart }) {
  const result = await db.query(
    `SELECT id, phone, profissional_id, servico_id, slot_start, status, expires_at, trinks_id, trace_id
       FROM booking_holds
      WHERE phone = $1
        AND profissional_id = $2
        AND slot_start = $3
        AND status IN ('held', 'committing')
      LIMIT 1`,
    [phone, String(profissionalId), slotStart],
  );
  return result.rows[0] || null;
}

/**
 * @returns {Promise<{ ok: true, hold: object, reused?: boolean } | { ok: false, reason: string }>}
 */
async function acquire(db, {
  phone,
  profissionalId,
  servicoId,
  slotStart,
  slotEnd = null,
  traceId = null,
} = {}) {
  const digits = digitsOnly(phone);
  const prof = profissionalId != null ? String(profissionalId) : '';
  const svc = servicoId != null ? String(servicoId) : '';
  const start = slotStart instanceof Date ? slotStart : parseSlotStart(slotStart);

  if (!db) return { ok: false, reason: 'unavailable' };
  if (!digits || !prof || !svc || !start) return { ok: false, reason: 'incomplete' };

  try {
    await expireStale(db);

    const existing = await lookupActiveForPhoneSlot(db, {
      phone: digits,
      profissionalId: prof,
      slotStart: start,
    });
    if (existing) {
      return { ok: true, hold: existing, reused: true };
    }

    const ttl = holdTtlSeconds();
    const inserted = await db.query(
      `INSERT INTO booking_holds
         (phone, profissional_id, servico_id, slot_start, slot_end, status, expires_at, trace_id)
       VALUES ($1, $2, $3, $4, $5, 'held', NOW() + ($6::int * INTERVAL '1 second'), $7)
       ON CONFLICT (profissional_id, slot_start) WHERE status IN ('held', 'committing')
       DO NOTHING
       RETURNING id, phone, profissional_id, servico_id, slot_start, status, expires_at, trinks_id, trace_id`,
      [digits, prof, svc, start, slotEnd, ttl, traceId],
    );

    if (inserted.rows[0]) {
      const hold = inserted.rows[0];
      emitOperationalEvent(db, {
        event: 'hold.created',
        clientPhone: digits,
        motivo: 'acquire',
        payload: { last4: last4(digits), holdId: hold.id },
      }).catch(() => {});
      return { ok: true, hold, reused: false };
    }

    const mine = await lookupActiveForPhoneSlot(db, {
      phone: digits,
      profissionalId: prof,
      slotStart: start,
    });
    if (mine) return { ok: true, hold: mine, reused: true };

    emitOperationalEvent(db, {
      event: 'hold.failed',
      clientPhone: digits,
      motivo: 'conflict',
      payload: { last4: last4(digits) },
    }).catch(() => {});
    return { ok: false, reason: 'conflict' };
  } catch (err) {
    emitOperationalEvent(db, {
      event: 'hold.failed',
      clientPhone: digits,
      motivo: 'unavailable',
      payload: { last4: last4(digits) },
    }).catch(() => {});
    return { ok: false, reason: 'unavailable' };
  }
}

async function acquireHoldForCreate(db, {
  phone,
  profissionalId,
  servicoId,
  dateTime,
  durationMinutes,
  traceId,
} = {}) {
  const start = parseSlotStart(dateTime);
  if (!start) return { ok: false, reason: 'incomplete' };
  let slotEnd = null;
  const dur = Number(durationMinutes);
  if (Number.isFinite(dur) && dur > 0) {
    slotEnd = new Date(start.getTime() + dur * 60 * 1000);
  }
  return acquire(db, {
    phone,
    profissionalId,
    servicoId,
    slotStart: start,
    slotEnd,
    traceId,
  });
}

async function setHoldStatus(db, holdId, status, extra = {}) {
  if (!db || !holdId) return null;
  const trinksId = extra.trinksId != null ? String(extra.trinksId) : null;
  const result = await db.query(
    `UPDATE booking_holds
        SET status = $2,
            trinks_id = CASE WHEN $2 = 'confirmed' THEN COALESCE($3, trinks_id) ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, status, trinks_id`,
    [holdId, status, trinksId],
  );
  return result.rows[0] || null;
}

async function markCommitting(db, holdId) {
  return setHoldStatus(db, holdId, 'committing');
}

async function markConfirmed(db, holdId, trinksId) {
  return setHoldStatus(db, holdId, 'confirmed', { trinksId });
}

async function markFailed(db, holdId) {
  return setHoldStatus(db, holdId, 'failed');
}

async function markReleased(db, holdId) {
  return setHoldStatus(db, holdId, 'released');
}

async function markRejected(db, holdId) {
  return setHoldStatus(db, holdId, 'rejected');
}

async function lookupActiveHoldForPhone(db, phone) {
  const digits = digitsOnly(phone);
  if (!db || !digits) return null;
  const result = await db.query(
    `SELECT id, phone, profissional_id, servico_id, slot_start, status, expires_at, trinks_id, trace_id
       FROM booking_holds
      WHERE phone = $1
        AND status IN ('held', 'committing')
      ORDER BY created_at DESC
      LIMIT 1`,
    [digits],
  );
  return result.rows[0] || null;
}

module.exports = {
  SLOT_UNAVAILABLE_COPY,
  holdTtlSeconds,
  last4,
  formatHeldCopy,
  isHeldAllowlistCopy,
  parseSlotStart,
  expireStale,
  acquire,
  acquireHoldForCreate,
  markCommitting,
  markConfirmed,
  markFailed,
  markReleased,
  markRejected,
  lookupActiveForPhoneSlot,
  lookupActiveHoldForPhone,
};
