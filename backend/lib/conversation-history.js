/**
 * Persistência de turnos em conversation_history.
 * Grava intent (VARCHAR 20) e trace_id (VARCHAR 64) — colunas já existentes.
 */

const { clipTraceId } = require('./tess-trace');

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function clipIntent(intent) {
  if (intent == null || intent === '') return null;
  return String(intent).slice(0, 20);
}

/**
 * @param {{ query: Function }} db
 * @param {string} phone
 * @param {Array<{ role: string, content: string, agent?: string, intent?: string, trace_id?: string }>} turns
 */
async function saveConversationTurns(db, phone, turns) {
  const digits = digitsOnly(phone);
  if (!digits || !db || typeof db.query !== 'function' || !turns?.length) return;
  for (const t of turns) {
    await db.query(
      `INSERT INTO conversation_history (client_phone, role, content, agent, intent, trace_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [digits, t.role, t.content, t.agent || null, clipIntent(t.intent), clipTraceId(t.trace_id)],
    );
  }
}

module.exports = {
  digitsOnly,
  clipIntent,
  saveConversationTurns,
};
