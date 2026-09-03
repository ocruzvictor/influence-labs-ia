/**
 * Aceite de handoff: owner Tiago, SLA 15 min em horário comercial.
 * Decisão Victor 2026-09-03. Sem mutar Trinks.
 */

const { isSalonOpen } = require('./salon-dates');
const { last4FromPhone, normalizeLast4, redactSnippet } = require('./nightwatch-ops');

const HANDOFF_OWNER = 'Tiago';
const HANDOFF_SLA_MINUTES = 15;

function computeHandoffSlaAt(now = new Date(), slaMinutes = HANDOFF_SLA_MINUTES) {
  const mins = Math.max(1, Number(slaMinutes) || HANDOFF_SLA_MINUTES);
  if (isSalonOpen(now).open) {
    return new Date(now.getTime() + mins * 60_000);
  }
  let cursor = new Date(now.getTime());
  // 288 × 15 min = 72h — cobre sáb 18h → ter 09h (~63h). 24h deixava SLA vencido no fim de semana (Quinn SLA-01).
  for (let i = 0; i < 288; i += 1) {
    cursor = new Date(cursor.getTime() + 15 * 60_000);
    if (isSalonOpen(cursor).open) {
      return new Date(cursor.getTime() + mins * 60_000);
    }
  }
  return new Date(now.getTime() + mins * 60_000);
}

function buildHandoffSlaPayload(now = new Date()) {
  const slaAt = computeHandoffSlaAt(now);
  return {
    owner: HANDOFF_OWNER,
    sla_minutes: HANDOFF_SLA_MINUTES,
    sla_at: slaAt.toISOString(),
    commercial_hours: Boolean(isSalonOpen(now).open),
  };
}

function formatHandoffSlaNotice(payload) {
  const sla = payload || buildHandoffSlaPayload();
  return (
    `SLA: ${sla.sla_minutes} min (horário comercial) · owner ${sla.owner}.\n` +
    `Prazo: ${sla.sla_at}. Sem aceite no prazo → re-alerta.`
  );
}

async function listHandoffSla(db, { minutos = 720 } = {}) {
  const windowMin = Math.min(2880, Math.max(15, Number(minutos) || 720));
  const handed = await db.query(
    `SELECT client_phone, motivo, payload, received_at
       FROM bot_operational_events
      WHERE event = 'handoff.human'
        AND received_at >= NOW() - ($1 * INTERVAL '1 minute')
      ORDER BY received_at DESC
      LIMIT 80`,
    [windowMin],
  );
  const accepted = await db.query(
    `SELECT client_phone, received_at
       FROM bot_operational_events
      WHERE event = 'handoff.accepted'
        AND received_at >= NOW() - ($1 * INTERVAL '1 minute')`,
    [windowMin],
  );
  const acceptedByPhone = new Map();
  for (const row of accepted?.rows || []) {
    const digits = String(row.client_phone || '').replace(/\D/g, '');
    const prev = acceptedByPhone.get(digits);
    if (!prev || new Date(row.received_at) > new Date(prev)) {
      acceptedByPhone.set(digits, row.received_at);
    }
  }
  const now = Date.now();
  const items = (handed?.rows || []).map((row) => {
    const digits = String(row.client_phone || '').replace(/\D/g, '');
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const slaAt = payload.sla_at ? new Date(payload.sla_at).getTime() : NaN;
    const acceptedAt = acceptedByPhone.get(digits);
    const accepted = acceptedAt && new Date(acceptedAt).getTime() >= new Date(row.received_at).getTime();
    const breached = !accepted && Number.isFinite(slaAt) && slaAt < now;
    return {
      last4: last4FromPhone(row.client_phone),
      owner: payload.owner || HANDOFF_OWNER,
      sla_at: payload.sla_at || null,
      received_at: row.received_at,
      motivo: redactSnippet(row.motivo, 80),
      accepted: Boolean(accepted),
      breached,
    };
  });
  return {
    owner: HANDOFF_OWNER,
    sla_minutes: HANDOFF_SLA_MINUTES,
    window_min: windowMin,
    items,
    breached: items.filter((i) => i.breached),
  };
}

async function acceptHandoff(db, { last4, emitEvent }) {
  const needle = normalizeLast4(last4);
  if (!needle) return { error: 'last4_required' };
  const found = await db.query(
    `SELECT client_phone
       FROM bot_operational_events
      WHERE event = 'handoff.human'
        AND RIGHT(regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g'), 4) = $1
      ORDER BY received_at DESC
      LIMIT 2`,
    [needle],
  );
  const phones = [...new Set((found?.rows || []).map((r) => String(r.client_phone || '').replace(/\D/g, '')).filter(Boolean))];
  if (phones.length > 1) return { last4: needle, error: 'ambiguous_last4' };
  if (phones.length === 0) return { last4: needle, error: 'handoff_nao_encontrado' };
  if (typeof emitEvent === 'function') {
    await emitEvent({
      event: 'handoff.accepted',
      clientPhone: phones[0],
      motivo: 'aceite_tiago',
      payload: { owner: HANDOFF_OWNER },
    });
  }
  return { last4: needle, accepted: true, owner: HANDOFF_OWNER };
}

async function realertBreachedHandoffs(db, { emitEvent } = {}) {
  const report = await listHandoffSla(db, { minutos: 720 });
  const sent = [];
  for (const item of report.breached) {
    if (typeof emitEvent === 'function') {
      await emitEvent({
        event: 'handoff.sla_breach',
        clientPhone: null,
        motivo: `sla_breach_${item.last4}`,
        payload: {
          last4: item.last4,
          owner: item.owner,
          sla_at: item.sla_at,
        },
      });
    }
    sent.push({
      last4: item.last4,
      owner: item.owner,
      sla_at: item.sla_at,
      notice: formatHandoffSlaNotice({
        owner: item.owner,
        sla_minutes: HANDOFF_SLA_MINUTES,
        sla_at: item.sla_at,
      }),
    });
  }
  return {
    owner: HANDOFF_OWNER,
    breached: sent.length,
    items: sent,
  };
}

module.exports = {
  HANDOFF_OWNER,
  HANDOFF_SLA_MINUTES,
  computeHandoffSlaAt,
  buildHandoffSlaPayload,
  formatHandoffSlaNotice,
  listHandoffSla,
  acceptHandoff,
  realertBreachedHandoffs,
};
