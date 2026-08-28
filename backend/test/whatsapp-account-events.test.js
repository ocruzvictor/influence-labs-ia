const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACCOUNT_V2_EVENTS,
  extractAccountUpdateEvents,
  extractKapsoAccountV2Events,
  handleMetaAccountUpdates,
  handleKapsoAccountV2Events,
} = require('../lib/whatsapp-account-events');

const V2_FIXTURES = {
  restricted: {
    id: 'wae_restricted_1',
    event: 'whatsapp.account.restricted',
    occurred_at: '2026-08-14T12:00:00.000000Z',
    business_account_id: '102290129340398',
    project: { id: 'proj-1' },
    phone_numbers: [{ id: '123456789012345', display_phone_number: '+1 555 010 1234' }],
    restrictions: [{ type: 'RESTRICTED_BIZ_INITIATED_MESSAGING', expires_at: '2026-09-14T12:00:00Z' }],
    source: { provider: 'meta', event: 'ACCOUNT_RESTRICTION' },
  },
  disabled: {
    id: 'wae_disabled_1',
    event: 'whatsapp.account.disabled',
    occurred_at: '2026-08-14T13:00:00.000000Z',
    business_account_id: '102290129340398',
    project: { id: 'proj-1' },
    phone_numbers: [{ id: '987654321098765', display_phone_number: '+55 11 97799-5967' }],
    ban: { state: 'DISABLE', date_label: '2026-08-14' },
    source: { provider: 'meta', event: 'ACCOUNT_DISABLE' },
  },
  reinstated: {
    id: 'wae_reinstated_1',
    event: 'whatsapp.account.reinstated',
    occurred_at: '2026-08-15T10:00:00.000000Z',
    business_account_id: '102290129340398',
    project: { id: 'proj-1' },
    phone_numbers: [{ id: '987654321098765' }],
    ban: { state: 'REINSTATE' },
    source: { provider: 'meta', event: 'ACCOUNT_REINSTATE' },
  },
  violation: {
    id: 'wae_violation_1',
    event: 'whatsapp.account.violation',
    occurred_at: '2026-08-16T08:00:00.000000Z',
    business_account_id: '102290129340398',
    project: { id: 'proj-1' },
    phone_numbers: [{ id: '111222333444555', display_phone_number: '+55 11 97799-5967' }],
    violation: { type: 'SPAM', remediation: 'Review messaging policy' },
    source: { provider: 'meta', event: 'ACCOUNT_VIOLATION' },
  },
};

test('ACCOUNT_V2_EVENTS contains all four Kapso v2 event names', () => {
  for (const name of Object.values(V2_FIXTURES).map(f => f.event)) {
    assert.equal(ACCOUNT_V2_EVENTS.has(name), true, name);
  }
});

test('extractKapsoAccountV2Events parses all four v2 event fixtures', () => {
  for (const [key, fixture] of Object.entries(V2_FIXTURES)) {
    const events = extractKapsoAccountV2Events(fixture);
    assert.equal(events.length, 1, key);
    assert.equal(events[0].event, fixture.event);
    assert.equal(events[0].waba_id, fixture.business_account_id);
    assert.equal(events[0].phone_number, fixture.phone_numbers[0].display_phone_number || fixture.phone_numbers[0].id);
    assert.equal(events[0].payload.project.id, 'proj-1');
  }
});

test('extractKapsoAccountV2Events parses batch envelope', () => {
  const events = extractKapsoAccountV2Events({
    batch: true,
    data: [V2_FIXTURES.restricted, V2_FIXTURES.disabled],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].event, 'whatsapp.account.restricted');
  assert.equal(events[1].event, 'whatsapp.account.disabled');
});

test('extractKapsoAccountV2Events returns empty for invalid or non-matching body', () => {
  assert.deepEqual(extractKapsoAccountV2Events(null), []);
  assert.deepEqual(extractKapsoAccountV2Events({ event: 'whatsapp.message.received' }), []);
  assert.deepEqual(extractKapsoAccountV2Events({ object: 'whatsapp_business_account' }), []);
  assert.deepEqual(extractKapsoAccountV2Events({ batch: true, data: [{ event: 'project.event' }] }), []);
});

test('extractAccountUpdateEvents parses PARTNER_REMOVED with disconnection_info', () => {
  const body = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '102290129340398',
      time: 1739212624,
      changes: [{
        field: 'account_update',
        value: {
          phone_number: '5511948319426',
          event: 'PARTNER_REMOVED',
          disconnection_info: {
            reason: 'PRIMARY_INACTIVITY',
            initiated_by: 'SYSTEM',
          },
        },
      }],
    }],
  };

  const events = extractAccountUpdateEvents(body);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'PARTNER_REMOVED');
  assert.equal(events[0].phone_number, '5511948319426');
  assert.equal(events[0].disconnection_info.reason, 'PRIMARY_INACTIVITY');
});

test('extractAccountUpdateEvents ignores non-account payloads', () => {
  assert.deepEqual(extractAccountUpdateEvents({ object: 'page' }), []);
  assert.deepEqual(extractAccountUpdateEvents(null), []);
});

test('handleMetaAccountUpdates persists and returns handled=true', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 1 }] };
    },
  };

  const result = await handleMetaAccountUpdates(db, {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      time: 1739212624,
      changes: [{
        field: 'account_update',
        value: { event: 'PARTNER_REMOVED', phone_number: '5511948319426' },
      }],
    }],
  }, 'kapso-meta');

  assert.equal(result.handled, true);
  assert.equal(result.inserted, 1);
  assert.match(calls[0].sql, /INSERT INTO whatsapp_account_events/);
  assert.equal(calls[0].params[0], 'kapso-meta');
  assert.equal(calls[0].params[2], 'PARTNER_REMOVED');
});

test('handleKapsoAccountV2Events persists with source kapso-v2', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 42 }] };
    },
  };

  const result = await handleKapsoAccountV2Events(db, V2_FIXTURES.restricted);

  assert.equal(result.handled, true);
  assert.equal(result.inserted, 1);
  assert.equal(result.events.length, 1);
  assert.match(calls[0].sql, /INSERT INTO whatsapp_account_events/);
  assert.equal(calls[0].params[0], 'kapso-v2');
  assert.equal(calls[0].params[2], 'whatsapp.account.restricted');
  assert.equal(calls[0].params[1], '102290129340398');
  assert.equal(calls[0].params[3], '+1 555 010 1234');

  const payload = JSON.parse(calls[0].params[5]);
  assert.equal(payload.kapso_event_id, 'wae_restricted_1');
  assert.equal(payload.restrictions[0].type, 'RESTRICTED_BIZ_INITIATED_MESSAGING');
});

test('handleKapsoAccountV2Events returns handled=false for non-account payload', async () => {
  const db = { query: async () => { throw new Error('should not query'); } };
  const result = await handleKapsoAccountV2Events(db, { event: 'whatsapp.message.received' });
  assert.equal(result.handled, false);
  assert.equal(result.events.length, 0);
});
