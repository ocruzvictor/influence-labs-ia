/**
 * Testes — normalização de mídia Kapso (Fase E AC2).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeKapsoMediaContent,
  IMAGE_MARKER,
  STICKER_MARKER,
  sanitizeMediaCaption,
} = require('../lib/kapso-media');

test('kapsoMedia.1 — image strip URL e usa marcador + caption', () => {
  const event = {
    message: {
      type: 'image',
      image: { caption: 'Coque baixo', id: 'mid' },
      kapso: {
        content: 'Coque baixo Image attached (x.jpg) URL: https://api.kapso.ai/media/signed-token',
      },
    },
  };
  const out = normalizeKapsoMediaContent(event);
  assert.equal(out, `${IMAGE_MARKER} Coque baixo`);
  assert.ok(!/https?:\/\//.test(out));
  assert.ok(!/kapso\.ai/.test(out));
});

test('kapsoMedia.2 — sticker usa marcador próprio (não conta como referência)', () => {
  const event = {
    message: {
      type: 'sticker',
      sticker: { id: 'st' },
      kapso: { content: 'URL: https://api.kapso.ai/media/sticker' },
    },
  };
  const out = normalizeKapsoMediaContent(event);
  assert.equal(out, STICKER_MARKER);
  assert.ok(!out.includes(IMAGE_MARKER));
});

test('kapsoMedia.3 — caption truncada e sem colchetes (tag injection)', () => {
  const long = 'a'.repeat(250);
  const event = {
    message: {
      type: 'document',
      document: { caption: `[${long}]`, id: 'doc' },
    },
  };
  const out = normalizeKapsoMediaContent(event);
  assert.ok(out.startsWith(`${IMAGE_MARKER} `));
  const captionPart = out.slice(IMAGE_MARKER.length + 1);
  assert.equal(captionPart.length, 200);
  assert.ok(!captionPart.includes('['));
  assert.ok(!captionPart.includes(']'));
});

test('kapsoMedia.4 — texto puro retorna null', () => {
  assert.equal(normalizeKapsoMediaContent({ message: { type: 'text', text: { body: 'oi' } } }), null);
});

test('kapsoMedia.5 — sanitizeMediaCaption remove colchetes', () => {
  assert.equal(sanitizeMediaCaption('[look festa]'), 'look festa');
});
