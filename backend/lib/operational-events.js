/**
 * Telemetria operacional do bot — handoff humano e falha de create Trinks.
 * Persistência fire-and-forget: erros são logados e nunca propagados.
 */

const { digitsOnly, isOwnerPhone } = require('./owner-access');

const MOTIVO_MAX = 500;

function sliceMotivo(text) {
  const s = String(text || '').trim();
  return s.length > MOTIVO_MAX ? s.slice(0, MOTIVO_MAX) : s;
}

/** Dono (Tiago) nunca gera evento handoff.human — mesma regra de markHumanHandled. */
function shouldEmitHandoff(phone) {
  const digits = digitsOnly(phone);
  if (!digits) return false;
  return !isOwnerPhone(digits);
}

async function emitOperationalEvent(db, {
  event,
  clientPhone,
  motivo,
  kapsoConversationId,
  payload = {},
}) {
  if (!db || !event) return;

  const phone = clientPhone ? digitsOnly(clientPhone) || null : null;

  try {
    await db.query(
      `INSERT INTO bot_operational_events
         (event, client_phone, motivo, kapso_conversation_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        event,
        phone,
        sliceMotivo(motivo),
        kapsoConversationId || null,
        JSON.stringify(payload || {}),
      ],
    );
  } catch (err) {
    console.error('[operational-events] persist error:', err.message);
  }
}

module.exports = {
  MOTIVO_MAX,
  sliceMotivo,
  shouldEmitHandoff,
  emitOperationalEvent,
};
