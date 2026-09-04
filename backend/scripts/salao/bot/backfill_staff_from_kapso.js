#!/usr/bin/env node
/**
 * Marca last_staff_outbound_at em fios com outbound Kapso que a Tess não enviou.
 * Uso (no container): node scripts/salao/bot/backfill_staff_from_kapso.js --horas 24
 */
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { persistStaffOutbound } = require('../../../lib/bot-thread-state');
const { normalizeOutboundText } = require('../../../lib/kapso-staff-outbound');
const { digitsOnly, isOwnerPhone } = require('../../../lib/owner-access');
const { fetchKapsoMessagesRaw, extractContactPhone, extractDirection, extractTimestampMs } = require('../../../supervisor');

loadBackendEnv();

function extractOrigin(msg) {
  return msg?.kapso?.origin || msg?.origin || '';
}

function extractText(msg) {
  return normalizeOutboundText(msg?.text?.body || msg?.kapso?.content || msg?.content || '');
}

async function ourTessSaid(db, phone, text) {
  const result = await db.query(
    `SELECT 1 FROM conversation_history
      WHERE client_phone = $1
        AND role = 'assistant'
        AND COALESCE(agent, '') NOT IN ('passive', 'human')
        AND regexp_replace(TRIM(content), '\\s+', ' ', 'g') = $2
        AND created_at > NOW() - interval '48 hours'
      LIMIT 1`,
    [phone, text],
  );
  return Boolean(result?.rows?.[0]);
}

async function main() {
  const { flags } = parseArgs();
  const horas = Number(flags.horas || 24);
  const db = requireDb();
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error('KAPSO_PHONE_NUMBER_ID ausente');

  const { messages } = await fetchKapsoMessagesRaw({ phoneNumberId, lookbackHours: horas });
  const marked = new Set();
  let inspected = 0;
  for (const msg of messages || []) {
    if (extractDirection(msg) !== 'outbound') continue;
    if (extractOrigin(msg) === 'history_sync') continue;
    const phone = digitsOnly(extractContactPhone(msg));
    if (!phone || isOwnerPhone(phone) || marked.has(phone)) continue;
    const text = extractText(msg);
    const ts = extractTimestampMs(msg);
    if (ts && Date.now() - ts > horas * 3600_000) continue;
    inspected += 1;
    if (text && await ourTessSaid(db, phone, text)) continue;
    await persistStaffOutbound(phone);
    marked.add(phone);
  }
  printJson({
    horas,
    inspected_outbound: inspected,
    marked_last4: [...marked].map((p) => p.slice(-4)),
    marked_count: marked.size,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
