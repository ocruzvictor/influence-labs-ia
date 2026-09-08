/**
 * Soft-lock local — story tess-redesenho-1.
 *
 *   node --test backend/test/booking-holds.test.js
 */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  holdTtlSeconds,
  formatHeldCopy,
  isHeldAllowlistCopy,
  acquire,
  acquireHoldForCreate,
  markCommitting,
  markConfirmed,
  markFailed,
  expireStale,
  lookupActiveHoldForPhone,
  SLOT_UNAVAILABLE_COPY,
} = require('../lib/booking-holds');

function slotMs(value) {
  return new Date(value).getTime();
}

function createFakeDb() {
  const rows = [];
  const events = [];
  let seq = 0;

  function activeOnSlot(prof, start) {
    return rows.find(
      (r) => r.profissional_id === String(prof)
        && slotMs(r.slot_start) === slotMs(start)
        && (r.status === 'held' || r.status === 'committing'),
    );
  }

  async function query(sql, params = []) {
    const text = String(sql);

    if (text.includes('INSERT INTO bot_operational_events')) {
      events.push({ event: params[0], payload: params[4] });
      return { rows: [] };
    }

    if (text.includes("SET status = 'expired'") && text.includes('expires_at <= NOW()')) {
      const now = Date.now();
      const expired = [];
      for (const row of rows) {
        if (row.status === 'held' && new Date(row.expires_at).getTime() <= now) {
          row.status = 'expired';
          row.updated_at = new Date();
          expired.push({ id: row.id, phone: row.phone });
        }
      }
      return { rows: expired };
    }

    if (text.includes('FROM booking_holds') && text.includes('status IN')) {
      if (params.length === 1) {
        const found = rows
          .filter((r) => r.phone === params[0] && (r.status === 'held' || r.status === 'committing'))
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return { rows: found[0] ? [found[0]] : [] };
      }
      const [phone, prof, start] = params;
      const found = rows.find(
        (r) => r.phone === phone
          && r.profissional_id === String(prof)
          && slotMs(r.slot_start) === slotMs(start)
          && (r.status === 'held' || r.status === 'committing'),
      );
      return { rows: found ? [found] : [] };
    }

    if (text.includes('INSERT INTO booking_holds')) {
      const [phone, prof, svc, start, slotEnd, ttl, traceId] = params;
      if (activeOnSlot(prof, start)) {
        return { rows: [] };
      }
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
      rows.push(row);
      return { rows: [{ ...row }] };
    }

    if (text.includes('UPDATE booking_holds') && text.includes('SET status = $2')) {
      const [holdId, status, trinksId] = params;
      const row = rows.find((r) => r.id === holdId);
      if (!row) return { rows: [] };
      row.status = status;
      row.trinks_id = status === 'confirmed' ? (trinksId || row.trinks_id) : null;
      row.updated_at = new Date();
      return { rows: [{ id: row.id, status: row.status, trinks_id: row.trinks_id }] };
    }

    return { rows: [] };
  }

  return {
    query,
    rows,
    events,
    seed(row) {
      rows.push(row);
    },
  };
}

const SLOT_13H = new Date('2026-09-08T13:00:00-03:00');

beforeEach(() => {
  delete process.env.BOOKING_HOLD_TTL_SEC;
});

test('holdTtlSeconds — default 180, clamp 120–300', () => {
  assert.equal(holdTtlSeconds({}), 180);
  assert.equal(holdTtlSeconds({ BOOKING_HOLD_TTL_SEC: '60' }), 120);
  assert.equal(holdTtlSeconds({ BOOKING_HOLD_TTL_SEC: '999' }), 300);
  assert.equal(holdTtlSeconds({ BOOKING_HOLD_TTL_SEC: '240' }), 240);
});

test('formatHeldCopy / allowlist — CRIT-1', () => {
  const copy = formatHeldCopy(SLOT_13H, 180);
  assert.equal(copy, '13h está separado por 180 min. Só vale quando eu confirmar o agendamento.');
  assert.equal(isHeldAllowlistCopy(copy), true);
  assert.equal(isHeldAllowlistCopy('Já estou confirmando na agenda, um instante.'), false);
  assert.match(SLOT_UNAVAILABLE_COPY, /indisponível/i);
});

test('T-13h — dois phones, mesmo profissional + 13h: um held, outro conflict', async () => {
  const db = createFakeDb();
  const first = await acquire(db, {
    phone: '11999994307',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  const second = await acquire(db, {
    phone: '11988887335',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  assert.equal(first.ok, true);
  assert.equal(first.reused, false);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'conflict');
  const held = db.rows.filter((r) => r.status === 'held');
  assert.equal(held.length, 1);
  assert.equal(held[0].phone.slice(-4), '4307');
});

test('T-TTL — expire lazy no acquire; copy posterior não é hold', async () => {
  const db = createFakeDb();
  db.seed({
    id: 'stale-1',
    phone: '11999996960',
    profissional_id: '3',
    servico_id: '12',
    slot_start: SLOT_13H,
    status: 'held',
    expires_at: new Date(Date.now() - 1000),
    trinks_id: null,
  });
  const next = await acquire(db, {
    phone: '11988889343',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  assert.equal(next.ok, true);
  const stale = db.rows.find((r) => r.id === 'stale-1');
  assert.equal(stale.status, 'expired');
  assert.equal(next.hold.phone.slice(-4), '9343');
  const expiredRows = await expireStale(db, { emit: false });
  assert.equal(expiredRows.length, 0);
});

test('T-idempotent — mesmo phone+slot enquanto held reusa o id', async () => {
  const db = createFakeDb();
  const a = await acquire(db, {
    phone: '11999997335',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  const b = await acquire(db, {
    phone: '11999997335',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  assert.equal(a.ok && b.ok, true);
  assert.equal(b.reused, true);
  assert.equal(a.hold.id, b.hold.id);
  assert.equal(db.rows.filter((r) => r.status === 'held').length, 1);
});

test('T-combo — segundo SKU no mesmo slot_start não cria segundo hold', async () => {
  const db = createFakeDb();
  const first = await acquireHoldForCreate(db, {
    phone: '11999996960',
    profissionalId: '3',
    servicoId: '12',
    dateTime: SLOT_13H.toISOString(),
    durationMinutes: 60,
  });
  const second = await acquireHoldForCreate(db, {
    phone: '11999996960',
    profissionalId: '3',
    servicoId: '34',
    dateTime: SLOT_13H.toISOString(),
    durationMinutes: 30,
  });
  assert.equal(first.ok && second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(first.hold.id, second.hold.id);
  assert.equal(db.rows.filter((r) => r.status === 'held').length, 1);
});

test('T-pg-down — NFR-6 fail-closed, 0 insert', async () => {
  const db = {
    query: async (sql) => {
      if (String(sql).includes('bot_operational_events')) return { rows: [] };
      throw new Error('ECONNREFUSED');
    },
  };
  const result = await acquire(db, {
    phone: '11999999343',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unavailable');
});

test('T-2xx — hold + committing + confirmed com trinks_id', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: '11999999343',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  await markCommitting(db, got.hold.id);
  const confirmed = await markConfirmed(db, got.hold.id, '201');
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.trinks_id, '201');
});

test('T-1734 — silêncio não muda hold held', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: '11999991734',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  const still = await lookupActiveHoldForPhone(db, '11999991734');
  assert.equal(got.hold.id, still.id);
  assert.equal(still.status, 'held');
});

test('T-ocupado-trinks — hold nosso + guard/HTTP ocupado → failed', async () => {
  const db = createFakeDb();
  const got = await acquire(db, {
    phone: '11999997335',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  const failed = await markFailed(db, got.hold.id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.trinks_id, null);
  const again = await acquire(db, {
    phone: '11988886960',
    profissionalId: '3',
    servicoId: '12',
    slotStart: SLOT_13H,
  });
  assert.equal(again.ok, true);
  assert.equal(again.reused, false);
});
