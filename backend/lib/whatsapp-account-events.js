/**
 * Parseia e persiste eventos account_update da Meta (ex.: PARTNER_REMOVED).
 * Usado por /webhook/kapso-meta (raw Meta via Kapso) e /webhook/meta (Meta direto).
 *
 * Eventos Kapso project webhook v2 (whatsapp.account.*) via /webhook/kapso-project.
 */

const ACCOUNT_UPDATE_FIELD = 'account_update';

const ACCOUNT_V2_EVENTS = new Set([
  'whatsapp.account.disabled',
  'whatsapp.account.restricted',
  'whatsapp.account.reinstated',
  'whatsapp.account.violation',
]);

function extractAccountUpdateEvents(body) {
  if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
    return [];
  }

  const events = [];
  for (const entry of body.entry) {
    const wabaId = entry?.id || null;
    const entryTime = entry?.time || null;
    for (const change of entry?.changes || []) {
      if (change?.field !== ACCOUNT_UPDATE_FIELD) continue;
      const value = change?.value || {};
      events.push({
        waba_id: wabaId,
        entry_time: entryTime,
        event: value.event || null,
        phone_number: value.phone_number || null,
        waba_info: value.waba_info || null,
        disconnection_info: value.disconnection_info || null,
        restriction_info: value.restriction_info || null,
        ban_info: value.ban_info || null,
        violation_info: value.violation_info || null,
        raw_value: value,
      });
    }
  }
  return events;
}

function extractKapsoAccountV2Events(body) {
  if (!body) return [];

  const items = (body.batch && Array.isArray(body.data)) ? body.data : [body];
  const events = [];

  for (const item of items) {
    if (!item || !ACCOUNT_V2_EVENTS.has(item.event)) continue;

    const phoneNumbers = item.phone_numbers || [];
    const firstPhone = phoneNumbers[0];
    const phoneNumber = firstPhone?.display_phone_number || firstPhone?.id || null;

    const {
      id: _id,
      event: _event,
      occurred_at: _occurredAt,
      business_account_id: _wabaId,
      project,
      phone_numbers: _phoneNumbers,
      ...rest
    } = item;

    events.push({
      kapso_event_id: item.id || null,
      event: item.event,
      occurred_at: item.occurred_at || null,
      waba_id: item.business_account_id || null,
      phone_number: phoneNumber,
      payload: {
        project,
        phone_numbers: phoneNumbers,
        ...rest,
      },
    });
  }

  return events;
}

async function persistAccountUpdateEvents(db, events, source) {
  if (!db || !events.length) return { inserted: 0 };

  let inserted = 0;
  for (const evt of events) {
    try {
      const entryTime = evt.entry_time != null
        ? new Date(Number(evt.entry_time) * 1000)
        : null;
      const result = await db.query(
        `INSERT INTO whatsapp_account_events
           (source, waba_id, event, phone_number, entry_time, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          source,
          evt.waba_id,
          evt.event,
          evt.phone_number,
          entryTime,
          JSON.stringify({
            waba_info: evt.waba_info,
            disconnection_info: evt.disconnection_info,
            restriction_info: evt.restriction_info,
            ban_info: evt.ban_info,
            violation_info: evt.violation_info,
            raw_value: evt.raw_value,
          }),
        ],
      );
      if (result?.rows?.[0]) inserted += 1;
    } catch (err) {
      console.error('[whatsapp-account] persist error:', err.message);
    }
  }
  return { inserted };
}

async function persistKapsoAccountV2Events(db, events) {
  if (!db || !events.length) return { inserted: 0 };

  let inserted = 0;
  for (const evt of events) {
    try {
      const entryTime = evt.occurred_at ? new Date(evt.occurred_at) : null;
      const result = await db.query(
        `INSERT INTO whatsapp_account_events
           (source, waba_id, event, phone_number, entry_time, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          'kapso-v2',
          evt.waba_id,
          evt.event,
          evt.phone_number,
          entryTime,
          JSON.stringify({
            kapso_event_id: evt.kapso_event_id,
            ...evt.payload,
          }),
        ],
      );
      if (result?.rows?.[0]) inserted += 1;
    } catch (err) {
      console.error('[whatsapp-account][kapso-v2] persist error:', err.message);
    }
  }
  return { inserted };
}

function logAccountUpdateEvent(evt, source) {
  const base = `[whatsapp-account][${source}] event=${evt.event} waba=${evt.waba_id || '?'} phone=${evt.phone_number || '?'}`;
  if (evt.event === 'PARTNER_REMOVED') {
    const reason = evt.disconnection_info?.reason || 'unknown';
    const by = evt.disconnection_info?.initiated_by || 'unknown';
    console.warn(`${base} PARTNER_REMOVED reason=${reason} initiated_by=${by}`);
    return;
  }
  console.log(base);
}

function logKapsoAccountV2Event(evt) {
  const base = `[whatsapp-account][kapso-v2] event=${evt.event} waba=${evt.waba_id || '?'} phone=${evt.phone_number || '?'}`;
  if (
    evt.event === 'whatsapp.account.disabled'
    || evt.event === 'whatsapp.account.restricted'
    || evt.event === 'whatsapp.account.violation'
  ) {
    console.warn(base);
    return;
  }
  console.log(base);
}

async function handleMetaAccountUpdates(db, body, source) {
  const events = extractAccountUpdateEvents(body);
  if (!events.length) return { handled: false, events: [] };

  for (const evt of events) logAccountUpdateEvent(evt, source);
  const { inserted } = await persistAccountUpdateEvents(db, events, source);
  return { handled: true, events, inserted };
}

async function handleKapsoAccountV2Events(db, body) {
  const events = extractKapsoAccountV2Events(body);
  if (!events.length) return { handled: false, events: [] };

  for (const evt of events) logKapsoAccountV2Event(evt);
  const { inserted } = await persistKapsoAccountV2Events(db, events);
  return { handled: true, events, inserted };
}

module.exports = {
  ACCOUNT_UPDATE_FIELD,
  ACCOUNT_V2_EVENTS,
  extractAccountUpdateEvents,
  extractKapsoAccountV2Events,
  persistAccountUpdateEvents,
  persistKapsoAccountV2Events,
  logAccountUpdateEvent,
  logKapsoAccountV2Event,
  handleMetaAccountUpdates,
  handleKapsoAccountV2Events,
};
