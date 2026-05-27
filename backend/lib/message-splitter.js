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

module.exports = {
  splitMessage,
  sleep,
};
