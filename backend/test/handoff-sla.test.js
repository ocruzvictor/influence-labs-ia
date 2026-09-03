const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSalonOpen } = require('../lib/salon-dates');
const {
  computeHandoffSlaAt,
  buildHandoffSlaPayload,
  listHandoffSla,
  acceptHandoff,
  HANDOFF_OWNER,
  HANDOFF_SLA_MINUTES,
} = require('../lib/handoff-sla');

test('SLA is 15 min while salon is open', () => {
  const now = new Date('2026-08-18T12:00:00-03:00');
  const sla = computeHandoffSlaAt(now);
  assert.equal(sla.getTime() - now.getTime(), 15 * 60_000);
});

test('closed Sunday waits until Tuesday open + 15 min', () => {
  const now = new Date('2026-08-16T15:00:00-03:00');
  const sla = computeHandoffSlaAt(now);
  const payload = buildHandoffSlaPayload(now);
  assert.equal(payload.owner, HANDOFF_OWNER);
  assert.equal(payload.sla_minutes, HANDOFF_SLA_MINUTES);
  assert.equal(payload.commercial_hours, false);
  assert.equal(isSalonOpen(sla).open, true);
  assert.equal(isSalonOpen(sla).weekday, 2);
  assert.equal(sla.toISOString(), new Date('2026-08-18T09:15:00-03:00').toISOString());
});

test('Saturday after close waits until Tuesday 09:15', () => {
  const now = new Date('2026-08-15T18:30:00-03:00');
  const sla = computeHandoffSlaAt(now);
  assert.equal(isSalonOpen(now).open, false);
  assert.equal(isSalonOpen(sla).open, true);
  assert.equal(sla.toISOString(), new Date('2026-08-18T09:15:00-03:00').toISOString());
});

test('listHandoffSla marks breach and last4 only', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes("event = 'handoff.accepted'")) return { rows: [] };
      return {
        rows: [{
          client_phone: '5511999996388',
          motivo: 'humano',
          payload: {
            owner: 'Tiago',
            sla_at: new Date(Date.now() - 60_000).toISOString(),
          },
          received_at: new Date(Date.now() - 20 * 60_000),
        }],
      };
    },
  };
  const report = await listHandoffSla(db, { minutos: 720 });
  assert.equal(report.items[0].last4, '6388');
  assert.equal(report.items[0].breached, true);
  assert.equal(report.breached.length, 1);
  assert.ok(!JSON.stringify(report).includes('5511999996388'));
});

test('acceptHandoff emits handoff.accepted', async () => {
  const events = [];
  const db = {
    query: async () => ({ rows: [{ client_phone: '5511999996388' }] }),
  };
  const result = await acceptHandoff(db, {
    last4: '6388',
    emitEvent: async (evt) => { events.push(evt); },
  });
  assert.equal(result.accepted, true);
  assert.equal(events[0].event, 'handoff.accepted');
  assert.equal(events[0].payload.owner, 'Tiago');
});
