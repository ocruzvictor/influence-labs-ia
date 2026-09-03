const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SUCCESS_COPY_RE } = require('../lib/nightwatch-ops');
const { startOutboundWatchdog, OUTBOX_COPY } = require('../lib/outbound-outbox');

test('watchdog copy never claims booking success', () => {
  assert.match(OUTBOX_COPY, /Não registrei nenhuma alteração na sua agenda/);
  assert.equal(SUCCESS_COPY_RE.test(OUTBOX_COPY), false);
});

test('markFinal prevents send', async () => {
  const sent = [];
  const watchdog = startOutboundWatchdog({
    phone: '5511999990007',
    sessionId: '5511999990007',
    phoneNumberId: 'pn',
    waitMs: 5_000,
    sendFn: async (to, text) => { sent.push({ to, text }); return true; },
    emitEvent: async () => {},
  });
  watchdog.markFinal();
  const result = await watchdog.fail('catch_sem_outbound');
  assert.equal(result.skipped, true);
  assert.equal(sent.length, 0);
});

test('fail sends honest copy once and emits event', async () => {
  const sent = [];
  const events = [];
  const watchdog = startOutboundWatchdog({
    phone: '5511999990007',
    sessionId: '5511999990007',
    phoneNumberId: 'pn',
    waitMs: 60_000,
    sendFn: async (to, text) => { sent.push({ to, text }); return true; },
    emitEvent: async (evt) => { events.push(evt); },
  });
  const first = await watchdog.fail('catch_sem_outbound');
  const second = await watchdog.fail('ack_sem_outbound');
  assert.equal(first.sent, true);
  assert.equal(second.skipped, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, OUTBOX_COPY);
  assert.equal(events[0].event, 'outbound.watchdog');
  assert.equal(events[0].payload.duplicate_ok, true);
});

test('send still happens when emitEvent rejects', async () => {
  const sent = [];
  const watchdog = startOutboundWatchdog({
    phone: '5511999990007',
    sessionId: '5511999990007',
    phoneNumberId: 'pn',
    waitMs: 60_000,
    sendFn: async (to, text) => { sent.push({ to, text }); return true; },
    emitEvent: async () => { throw new Error('db down'); },
  });
  const result = await watchdog.fail('catch_sem_outbound');
  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
});
