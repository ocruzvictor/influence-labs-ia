const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isSalonOpen } = require('../lib/salon-dates');
const {
  computeHandoffSlaAt,
  buildHandoffSlaPayload,
  listHandoffSla,
  acceptHandoff,
  HANDOFF_OWNER,
  HANDOFF_SLA_MINUTES,
  HANDOFF_LINGER_COPY,
  isHandoffLingerAck,
  appendHandoffLingerBlocks,
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

test('P2.3 linger — Ok é ack; append uma vez', () => {
  assert.equal(isHandoffLingerAck('Ok'), true);
  assert.equal(isHandoffLingerAck('quero cortar'), false);
  const once = appendHandoffLingerBlocks(['Vou passar pra recepção.'], { motivo: 'encaixe' });
  assert.equal(once.length, 2);
  assert.equal(once[1], HANDOFF_LINGER_COPY);
  const twice = appendHandoffLingerBlocks(once, { motivo: 'encaixe' });
  assert.equal(twice.filter((b) => b === HANDOFF_LINGER_COPY).length, 1);
});

test('P2.3/P2.4/6 wired in server.js', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(src, /\[booking\.digest\] last4=/);
  assert.match(src, /appendHandoffLingerBlocks/);
  assert.match(src, /durationMs: Date\.now\(\) - tessCallStarted/);
  assert.match(src, /handoff\.linger_ack/);
  assert.match(src, /isStaffSpokeRecently/);
});
