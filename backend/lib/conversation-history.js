/**
 * Persistência de turnos em conversation_history.
 * Grava intent quando o classificador já rodou (coluna existente, VARCHAR 20).
 */

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
 * @param {Array<{ role: string, content: string, agent?: string, intent?: string }>} turns
 */
async function saveConversationTurns(db, phone, turns) {
  const digits = digitsOnly(phone);
  if (!digits || !db || typeof db.query !== 'function' || !turns?.length) return;
  for (const t of turns) {
    await db.query(
      `INSERT INTO conversation_history (client_phone, role, content, agent, intent)
       VALUES ($1, $2, $3, $4, $5)`,
      [digits, t.role, t.content, t.agent || null, clipIntent(t.intent)],
    );
  }
}

module.exports = {
  digitsOnly,
  clipIntent,
  saveConversationTurns,
};
