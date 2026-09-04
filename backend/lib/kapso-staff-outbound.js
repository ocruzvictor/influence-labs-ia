/**
 * Distingue eco da Tess (cloud_api que NÓS enviamos) de outbound da recepção
 * no painel Kapso (também sai como cloud_api).
 */

const { digitsOnly } = require('./owner-access');

const BOT_ECHO_WINDOW_MS = 10 * 60 * 1000;
const IGNORE_ORIGINS = new Set(['history_sync']);

/** @type {Map<string, Array<{ text: string, at: number }>>} */
const recentBotSends = new Map();

function normalizeOutboundText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractOutboundText(message) {
  if (!message) return '';
  if (message.type === 'text' || message.text?.body) {
    return normalizeOutboundText(message.text?.body || '');
  }
  return normalizeOutboundText(message.kapso?.content || '');
}

function pruneSends(phone, now = Date.now()) {
  const list = (recentBotSends.get(phone) || []).filter((row) => now - row.at < BOT_ECHO_WINDOW_MS);
  if (list.length) recentBotSends.set(phone, list);
  else recentBotSends.delete(phone);
  return list;
}

function rememberBotSend(phone, text) {
  const digits = digitsOnly(phone);
  const body = normalizeOutboundText(text);
  if (!digits || !body) return;
  const list = pruneSends(digits);
  list.push({ text: body, at: Date.now() });
  recentBotSends.set(digits, list);
}

function isRememberedBotSend(phone, text, now = Date.now()) {
  const digits = digitsOnly(phone);
  const body = normalizeOutboundText(text);
  if (!digits || !body) return false;
  const list = pruneSends(digits, now);
  const idx = list.findIndex((row) => row.text === body);
  if (idx < 0) return false;
  list.splice(idx, 1);
  if (list.length) recentBotSends.set(digits, list);
  else recentBotSends.delete(digits);
  return true;
}

/**
 * @param {{ direction?: string, origin?: string, phone?: string, text?: string }} evt
 * @returns {boolean}
 */
function isStaffOutbound(evt) {
  const direction = evt?.direction;
  const origin = evt?.origin || '';
  if (direction !== 'outbound') return false;
  if (IGNORE_ORIGINS.has(origin)) return false;
  if (isRememberedBotSend(evt.phone, evt.text)) return false;
  return true;
}

function resetBotSendMemoryForTests() {
  recentBotSends.clear();
}

module.exports = {
  BOT_ECHO_WINDOW_MS,
  normalizeOutboundText,
  extractOutboundText,
  rememberBotSend,
  isRememberedBotSend,
  isStaffOutbound,
  resetBotSendMemoryForTests,
};
