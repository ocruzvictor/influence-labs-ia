/**
 * Splitter tag-aware para mensagens com separador `<break>`.
 *
 * Single source of truth. Importado por:
 *   - backend/server.js (uso em prod — chamado dentro de sendKapsoMessage)
 *   - backend/test/message-splitter.test.js (testes unitários)
 *
 * Contexto: o prompt TESS Conversa v3+ pode emitir `<break>` no output do LLM
 * para que respostas conversacionais sejam quebradas em 2-4 mensagens curtas no
 * WhatsApp, replicando a cadência humana. Implementação ingênua
 * (`text.split('<break>')`) quebraria tags inline (`[BOOKING_*]`, `[HANDOFF_*]`),
 * destruindo o pipeline de booking em produção.
 *
 * Garantias:
 *   1. `<break>` NUNCA é processado dentro de uma tag — se aparecer (defensivo,
 *      o prompt já proíbe), é removido e logado como WARN.
 *   2. Tag inline (`[BOOKING_*]`, `[HANDOFF_*]`) sempre permanece íntegra em
 *      uma única bolha — nunca dividida entre bolhas.
 *   3. Texto sem `<break>` retorna array com 1 elemento (comportamento de
 *      passagem direta — zero overhead).
 *   4. Strings vazias entre delimitadores não geram bolhas vazias.
 *
 * Story: docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md (A3)
 */

// Regex que cobre o conjunto fechado de tags inline emitidas pelo prompt v3.
// Não há regex genérica de `[...]` porque queremos ser explícitos sobre quais
// tags são protegidas — emojis e nomes entre colchetes em texto normal não
// devem ser tratados como tag protegida.
const TAG_REGEX = /\[(BOOKING_CREATE|BOOKING_CANCEL|BOOKING_RESCHEDULE|HANDOFF_HUMAN)[^\]]*\]/gs;

const BREAK_TOKEN = /<break>/gi;

/**
 * Divide um texto em bolhas usando `<break>` como delimitador, preservando
 * a integridade de tags inline.
 *
 * @param {string} text — output cru do LLM (pode conter <break> e tags)
 * @returns {string[]} array com 0+ bolhas (vazio só se input vazio/null)
 */
function splitMessage(text) {
  if (!text || typeof text !== 'string') return [];

  // Sanitização defensiva: strip NUL bytes do input.
  // Usamos \x00 como delimitador do placeholder (\x00TAG{n}\x00) na Fase 1;
  // se o input já contém \x00, a Fase 3 acharia placeholders falsos e
  // tentaria substituí-los pelo tag de índice correspondente — que pode
  // estar undefined, gerando string literal "undefined" no output.
  // LLMs comerciais strip NUL bytes, mas isto é defesa em profundidade.
  text = text.replace(/\x00/g, '');
  if (!text) return [];

  // Fase 1: extrai todas as tags e substitui por placeholders únicos.
  // Ao mesmo tempo, remove (defensivamente) qualquer <break> que tenha
  // aparecido dentro da tag — o prompt já proíbe isso, mas o LLM pode
  // ocasionalmente errar. Loga WARN quando acontece.
  const tags = [];
  const protectedText = text.replace(TAG_REGEX, (match) => {
    // Cria nova regex local pra evitar problemas com flag /g de regex compartilhada
    const hasBreakInside = /<break>/i.test(match);
    if (hasBreakInside) {
      const cleanedTag = match.replace(/<break>/gi, '').replace(/\s+/g, ' ').trim();
      console.warn(
        `[message-splitter] <break> dentro de tag detectado e removido. ` +
        `Original: "${match.slice(0, 100)}${match.length > 100 ? '…' : ''}" → ` +
        `Limpo: "${cleanedTag.slice(0, 100)}${cleanedTag.length > 100 ? '…' : ''}"`
      );
      tags.push(cleanedTag);
    } else {
      tags.push(match);
    }
    // Placeholder usa NUL bytes (\x00) que nunca aparecem em output natural de LLM.
    // Sobrevive a trim() e splits sem requerer whitespace ao redor.
    return `\x00TAG${tags.length - 1}\x00`;
  });

  // Fase 2: quebra o texto protegido pelos <break>.
  const bubbles = protectedText
    .split(/<break>/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Fase 3: restaura as tags em cada bolha que contém placeholder.
  return bubbles.map(b =>
    b.replace(/\x00TAG(\d+)\x00/g, (_, i) => tags[Number(i)])
  );
}

/**
 * Helper de delay entre bolhas (para typing indicator).
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitLongChunk(chunk, maxLen) {
  if (chunk.length <= maxLen) return [chunk];
  const sentences = chunk.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [chunk];
  const parts = [];
  let current = '';
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + ' ' + sentence).length <= maxLen) {
      current += ' ' + sentence;
    } else {
      parts.push(current);
      current = sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Quebra texto longo em bolhas WhatsApp.
 * Nunca descarta conteúdo: se passar de maxBubbles, junta o restante na última bolha.
 * Se o texto já tem <break>, devolve 1 bloco para o sendKapsoMessage fazer o split único.
 */
function toWhatsappBlocks(text, { maxBubbles = 8 } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (/<break>/i.test(raw)) return [raw];

  const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const roughBlocks = paragraphs.length ? paragraphs : [raw];
  const expanded = [];
  for (const block of roughBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const hasList = lines.some(l => l.startsWith('- '));
    if (hasList || block.length <= 340) {
      expanded.push(block);
      continue;
    }
    expanded.push(...splitLongChunk(block, 300));
  }

  const compact = [];
  for (const block of expanded) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const prev = compact[compact.length - 1];
    if (prev && !prev.includes('\n') && !trimmed.includes('\n') && (prev.length + trimmed.length + 1 <= 300)) {
      compact[compact.length - 1] = `${prev} ${trimmed}`;
    } else {
      compact.push(trimmed);
    }
  }

  const cap = Math.max(1, Number(maxBubbles) || 8);
  if (compact.length <= cap) return compact;
  return [...compact.slice(0, cap - 1), compact.slice(cap - 1).join('\n\n')];
}

const WHATSAPP_TEXT_SAFE_LEN = 3900;

/**
 * Meta Cloud API cobra por mensagem entregue. Junta <break>/parágrafos num único
 * envio. Só parte se estourar o limite de texto do WhatsApp (~4096).
 */
function collapseToKapsoSends(text, { maxLen = WHATSAPP_TEXT_SAFE_LEN } = {}) {
  const raw = String(text || '').replace(/<break>/gi, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!raw) return [];
  const cap = Math.max(200, Number(maxLen) || WHATSAPP_TEXT_SAFE_LEN);
  if (raw.length <= cap) return [raw];
  const parts = [];
  let rest = raw;
  while (rest.length > cap) {
    let cut = rest.lastIndexOf('\n', cap);
    if (cut < cap * 0.5) cut = rest.lastIndexOf(' ', cap);
    if (cut < cap * 0.5) cut = cap;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

module.exports = {
  splitMessage,
  sleep,
  toWhatsappBlocks,
  collapseToKapsoSends,
  WHATSAPP_TEXT_SAFE_LEN,
};
