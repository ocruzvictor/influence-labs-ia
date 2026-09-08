/**
 * Martelo — story tess-redesenho-2.
 *
 *   node --test backend/test/handoff-martelo.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { acquire, markRejected } = require('../lib/booking-holds');
const {
  PENDING_ASSIGNED,
  REJECT_COPY,
  handoffSlaSeconds,
  isNamedAssignee,
  ensurePending,
  canCommit,
  actOnReceipt,
  timeoutStale,
  gateCommit,
} = require('../lib/booking-handoff-receipts');
const { HOLD_COPY, sanitizePrematureConfirm, selectOutboundBlocks } = require('../lib/booking-parser');

function createFakeDb() {
  const holds = [];
  const receipts = [];
  let seq = 0;

  function slotMs(value) {
    return new Date(value).getTime();
  }

  async function query(sql, params = []) {
    const text = String(sql);
    if (text.includes('INSERT INTO bot_operational_events')) return { rows: [] };

    if (text.includes("SET status = 'expired'") && text.includes('booking_holds')) {
      return { rows: [] };
    }

    if (text.includes('FROM booking_holds') && text.includes('status IN')) {
      if (params.length === 1) {
        const found = holds.filter((r) => r.phone === params[0] && (r.status === 'held' || r.status === 'committing'));
        return { rows: found[0] ? [found[0]] : [] };
      }
      const [phone, prof, start] = params;
      const found = holds.find(
        (r) => r.phone === phone
          && r.profissional_id === String(prof)
          && slotMs(r.slot_start) === slotMs(start)
          && (r.status === 'held' || r.status === 'committing'),
      );
      return { rows: found ? [found] : [] };
    }

    if (text.includes('INSERT INTO booking_holds')) {
      const [phone, prof, svc, start, slotEnd, ttl, traceId] = params;
      seq += 1;
      const row = {
        id: `hold-${seq}`,
        phone,
        profissional_id: String(prof),
        servico_id: String(svc),
        slot_start: new Date(start),
        slot_end: slotEnd,
        status: 'held',
        expires_at: new Date(Date.now() + Number(ttl) * 1000),
        trinks_id: null,
        trace_id: traceId,
      };
      holds.push(row);
      return { rows: [{ ...row }] };
    }

    if (text.includes('UPDATE booking_holds') && text.includes('SET status = $2')) {
      const [holdId, status, trinksId] = params;
      const row = holds.find((r) => r.id === holdId);
      if (!row) return { rows: [] };
      row.status = status;
      row.trinks_id = status === 'confirmed' ? (trinksId || row.trinks_id) : null;
      return { rows: [{ id: row.id, status: row.status, trinks_id: row.trinks_id }] };
    }

    if (text.includes("SET action = 'timeout'")) {
      const now = Date.now();
      const timed = [];
      for (const row of receipts) {
        if (row.action === 'pending' && new Date(row.sla_until).getTime() <= now) {
          row.action = 'timeout';
          timed.push({ ...row });
        }
      }
      return { rows: timed };
    }

    if (text.includes('FROM booking_handoff_receipts') && text.includes('WHERE hold_id = $1') && text.includes('ORDER BY')) {
      const found = receipts.filter((r) => r.hold_id === params[0]).sort((a, b) => b.created_at - a.created_at);
      return { rows: found[0] ? [found[0]] : [] };
    }

    if (text.includes('FROM booking_handoff_receipts') && text.includes('WHERE id = $1')) {
      const found = receipts.find((r) => r.id === params[0]);
      return { rows: found ? [found] : [] };
    }

    if (text.includes('INSERT INTO booking_handoff_receipts')) {
      const [holdId, phone, assigned, sla] = params;
      if (receipts.some((r) => r.hold_id === holdId && r.action === 'pending')) {
        return { rows: [] };
      }
      seq += 1;
      const row = {
        id: `rcpt-${seq}`,
        hold_id: holdId,
        phone,
        assigned_to: assigned,
        sla_until: new Date(Date.now() + Number(sla) * 1000),
        action: 'pending',
        acted_at: null,
        note: null,
        created_at: Date.now(),
      };
      receipts.push(row);
      return { rows: [{ ...row }] };
    }

    if (text.includes('UPDATE booking_handoff_receipts') && text.includes('acted_at')) {
      const [receiptId, action, assignedTo, note] = params;
      const row = receipts.find((r) => r.id === receiptId && r.action === 'pending');
      if (!row) return { rows: [] };
      row.action = action;
      row.assigned_to = assignedTo;
      row.acted_at = new Date();
      row.note = note;
      return { rows: [{ ...row }] };
    }

    return { rows: [] };
  }

  return { query, holds, receipts, seedReceipt(row) { receipts.push(row); } };
}

const SLOT = new Date('2026-09-08T13:00:00-03:00');
const PHONE = '11999991734';

test('handoffSlaSeconds — default 900, clamp 300–3600', () => {
  assert.equal(handoffSlaSeconds({}), 900);
  assert.equal(handoffSlaSeconds({ BOOKING_HANDOFF_SLA_SEC: '60' }), 300);
  assert.equal(handoffSlaSeconds({ BOOKING_HANDOFF_SLA_SEC: '9999' }), 3600);
});

test('assigned_to veto Pedro — recepção/staff/queue:owner não são nomeados', () => {
  assert.equal(isNamedAssignee('recepção'), false);
  assert.equal(isNamedAssignee('staff'), false);
  assert.equal(isNamedAssignee(PENDING_ASSIGNED), false);
  assert.equal(isNamedAssignee('Ana Recepção'), true);
});

test('T-1734 — staff/silence não solta hold; sem HOLD_COPY', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  const pending = await ensurePending(db, { holdId: got.hold.id, phone: PHONE });
  assert.equal(pending.ok, true);
  assert.equal(pending.receipt.assigned_to, PENDING_ASSIGNED);
  assert.equal(db.holds[0].status, 'held');
  const gate = await canCommit(db, got.hold.id);
  assert.equal(gate.canCommit, false);
  assert.ok(!/já estou confirmando/i.test(REJECT_COPY));
  assert.notEqual(REJECT_COPY, HOLD_COPY);
});

test('T-Denise — sem approved ≠ confirmed; copy sem confirmado', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  await ensurePending(db, { holdId: got.hold.id, phone: PHONE });
  const gate = await gateCommit(db, { holdId: got.hold.id, phone: PHONE, required: true });
  assert.equal(gate.canCommit, false);
  assert.notEqual(db.holds[0].status, 'confirmed');
  const sanitized = sanitizePrematureConfirm('Confirmado! Te esperamos. Já estou confirmando na agenda, um instante.');
  assert.ok(!/confirmado/i.test(sanitized));
  assert.ok(!/te esperamos/i.test(sanitized));
  const blocks = selectOutboundBlocks({
    formattedResponses: [sanitized],
    finalMessages: [],
    bookingCreatedThisTurn: false,
  });
  assert.ok(!blocks.some((b) => /confirmado|endereço|te esperamos/i.test(b)));
  assert.match(REJECT_COPY, /não ficou gravado/i);
});

test('T-SLA — timeout não libera hold; evento timeout', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  db.seedReceipt({
    id: 'rcpt-stale',
    hold_id: got.hold.id,
    phone: '11999991734',
    assigned_to: PENDING_ASSIGNED,
    sla_until: new Date(Date.now() - 1000),
    action: 'pending',
    created_at: Date.now() - 2000,
  });
  const timed = await timeoutStale(db, { emit: false });
  assert.equal(timed.length, 1);
  assert.equal(timed[0].action, 'timeout');
  assert.equal(db.holds[0].status, 'held');
  const gate = await canCommit(db, got.hold.id);
  assert.equal(gate.canCommit, false);
});

test('approve nomeado libera COMMITTING; reject libera unique', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  const pending = await ensurePending(db, { holdId: got.hold.id, phone: PHONE });
  const bad = await actOnReceipt(db, pending.receipt.id, { action: 'approved', assignedTo: 'recepção' });
  assert.equal(bad.ok, false);
  const ok = await actOnReceipt(db, pending.receipt.id, { action: 'approved', assignedTo: 'Ana Recepção' });
  assert.equal(ok.ok, true);
  assert.equal(ok.receipt.action, 'approved');
  assert.ok(ok.receipt.acted_at);
  const gate = await canCommit(db, got.hold.id);
  assert.equal(gate.canCommit, true);

  const other = await acquire(db, {
    phone: '11988886960',
    profissionalId: '4',
    servicoId: '12',
    slotStart: SLOT,
  });
  const p2 = await ensurePending(db, { holdId: other.hold.id, phone: '11988886960' });
  const rej = await actOnReceipt(db, p2.receipt.id, { action: 'rejected', assignedTo: 'Ana Recepção' });
  assert.equal(rej.ok, true);
  assert.equal(db.holds.find((h) => h.id === other.hold.id).status, 'rejected');
});

test('ensurePending é idempotente no mesmo hold', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  const a = await ensurePending(db, { holdId: got.hold.id, phone: PHONE });
  const b = await ensurePending(db, { holdId: got.hold.id, phone: PHONE });
  assert.equal(a.receipt.id, b.receipt.id);
  assert.equal(b.reused, true);
});

test('gateCommit sem staff required=false libera auto-commit story 1', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  const gate = await gateCommit(db, { holdId: got.hold.id, phone: PHONE, required: false });
  assert.equal(gate.canCommit, true);
});

test('REJECT_COPY não afirma sucesso', () => {
  assert.ok(!/confirmado|endereço|te esperamos|já estou confirmando/i.test(REJECT_COPY));
});

// keep markRejected referenced for AC6 unique-free after reject
test('markRejected libera unique do hold', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: PHONE,
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  await markRejected(db, got.hold.id);
  const again = await acquire(db, {
    phone: '11988880007',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT,
  });
  assert.equal(again.ok, true);
});
