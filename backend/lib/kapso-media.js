/**
 * Normalização de inbound Kapso/Meta com mídia — evita vazar URL assinada ao TESS/histórico.
 * Story Fase E AC2.
 */

const MEDIA_TYPES = new Set(['image', 'sticker', 'document', 'video']);
const IMAGE_MARKER = '[CLIENTE ENVIOU IMAGEM]';
const STICKER_MARKER = '[CLIENTE ENVIOU STICKER]';
const CAPTION_MAX = 200;

function sanitizeMediaCaption(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[\[\]]/g, '');
  if (s.length > CAPTION_MAX) s = s.slice(0, CAPTION_MAX);
  return s;
}

function extractMediaCaption(message) {
  const msg = message || {};
  const type = msg.type;
  const typePayload = type && msg[type] ? msg[type] : {};
  const kapso = msg.kapso || {};
  return sanitizeMediaCaption(
    typePayload.caption
    || kapso.message_type_data?.caption
    || '',
  );
}

/**
 * @param {{ message?: object }} event — evento Kapso webhook (ou { message: msg } Meta)
 * @returns {string|null} Marcador determinístico sem URL, ou null se não for mídia
 */
function normalizeKapsoMediaContent(event) {
  const message = event?.message;
  if (!message || !MEDIA_TYPES.has(message.type)) return null;

  const marker = message.type === 'sticker' ? STICKER_MARKER : IMAGE_MARKER;
  const caption = extractMediaCaption(message);
  return caption ? `${marker} ${caption}` : marker;
}

function isKapsoMediaMessage(message) {
  return MEDIA_TYPES.has(message?.type);
}

module.exports = {
  normalizeKapsoMediaContent,
  isKapsoMediaMessage,
  IMAGE_MARKER,
  STICKER_MARKER,
  sanitizeMediaCaption,
};
