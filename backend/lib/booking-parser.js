/**
 * Parser de tags de booking emitidas pelo TESS Conversa.
 *
 * Single source of truth. Importado por:
 *   - backend/server.js (uso em prod)
 *   - scripts/test-parser-tags.mjs (testes unitários)
 *
 * Suporta dois formatos:
 *
 *   v2 inline (canônico atual, formato preferido pelo prompt v2):
 *     [BOOKING_CREATE servicoId=1 profissionalId=3 dataHoraInicio=2026-05-30T10:30:00-03:00 valor=85 duracaoMinutos=60]
 *     [BOOKING_CANCEL bookingId=12345 motivo=cliente_desistiu]
 *     [BOOKING_RESCHEDULE bookingId=12345 novoDataHoraInicio=2026-06-01T14:00:00-03:00 servicoId=1 profissionalId=3]
 *     [HANDOFF_HUMAN motivo=reclamacao_atraso]
 *
 *   v1 legacy (preservado pra retrocompat com agentes antigos):
 *     [BOOKING_CONFIRM]
 *     {"service_id":1,"professional_id":3,"date_time":"...","valor":85}
 *
 *     [BOOKING_CANCEL]
 *     {"agendamento_id":12345,"motivo":"..."}
 *
 *     [BOOKING_RESCHEDULE]
 *     {"agendamento_id":12345,"date_time":"..."}
 */

// Normaliza aspas Unicode antes de JSON.parse — TESS as vezes emite com aspas curvas
// (especialmente se o prompt foi editado em painel com auto-correct).
function normalizeJsonQuotes(s) {
  return s
    .replace(/[“”]/g, '"')   // " " → "
    .replace(/[‘’]/g, "'")   // ' ' → '
    .replace(/ /g, ' ');     // NBSP → espaco normal
}

// Parse de key=value separados por espaço. Valores podem conter ISO8601 (com T, : e -).
function parseInlineArgs(argsStr) {
  const args = {};
  const re = /(\w+)=([^\s\]]+)/g;
  let m;
  while ((m = re.exec(argsStr)) !== null) {
    args[m[1]] = m[2];
  }
  return args;
}

/**
 * Remove tags de booking do texto e retorna estrutura normalizada.
 *
 * @param {string} tessText texto bruto retornado pelo agente Conversa
 * @returns {{clean: string, bookingConfirm: object|null, bookingCancel: object|null, bookingReschedule: object|null, handoffHuman: object|null}}
 */
function stripBookingTags(tessText) {
  let clean = tessText;
  let bookingConfirm = null;
  let bookingCancel = null;
  let bookingReschedule = null;
  let handoffHuman = null;

  // --- (a) Formato v2 inline ---
  const createInline = clean.match(/\[BOOKING_CREATE\s+([^\]]+)\]/i);
  if (createInline) {
    const a = parseInlineArgs(createInline[1]);
    if (a.servicoId || a.dataHoraInicio || a.profissionalId) {
      bookingConfirm = {
        service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
        professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
        date_time: a.dataHoraInicio || undefined,
        valor: a.valor ? parseFloat(a.valor) : undefined,
        duration_minutes: a.duracaoMinutos ? parseInt(a.duracaoMinutos, 10) : undefined,
      };
    }
    clean = clean.replace(createInline[0], '').trim();
  }

  const cancelInline = clean.match(/\[BOOKING_CANCEL\s+([^\]]+)\]/i);
  if (cancelInline) {
    const a = parseInlineArgs(cancelInline[1]);
    if (a.bookingId) {
      bookingCancel = {
        agendamento_id: parseInt(a.bookingId, 10),
        motivo: a.motivo,
      };
    }
    clean = clean.replace(cancelInline[0], '').trim();
  }

  const reschedInline = clean.match(/\[BOOKING_RESCHEDULE\s+([^\]]+)\]/i);
  if (reschedInline) {
    const a = parseInlineArgs(reschedInline[1]);
    if (a.bookingId && a.novoDataHoraInicio) {
      bookingReschedule = {
        agendamento_id: parseInt(a.bookingId, 10),
        date_time: a.novoDataHoraInicio,
        service_id: a.servicoId ? parseInt(a.servicoId, 10) : undefined,
        professional_id: a.profissionalId ? parseInt(a.profissionalId, 10) : undefined,
      };
    }
    clean = clean.replace(reschedInline[0], '').trim();
  }

  const handoffInline = clean.match(/\[HANDOFF_HUMAN(?:\s+([^\]]+))?\]/i);
  if (handoffInline) {
    const a = handoffInline[1] ? parseInlineArgs(handoffInline[1]) : {};
    handoffHuman = { motivo: a.motivo || 'cliente_pediu_humano' };
    clean = clean.replace(handoffInline[0], '').trim();
  }

  // --- (b) Formato v1 legacy (BOOKING_CONFIRM + JSON) — preservado para retrocompatibilidade ---
  if (!bookingConfirm) {
    const confMatch = clean.match(/\[BOOKING_CONFIRM\]\s*\n?({[\s\S]*?})/i);
    if (confMatch) {
      try { bookingConfirm = JSON.parse(normalizeJsonQuotes(confMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_CONFIRM JSON parse falhou:', err.message, '| raw:', confMatch[1].slice(0, 200)); }
      clean = clean.replace(confMatch[0], '').trim();
    }
  }
  if (!bookingCancel) {
    const cancelMatch = clean.match(/\[BOOKING_CANCEL\]\s*\n?({[\s\S]*?})/i);
    if (cancelMatch) {
      try { bookingCancel = JSON.parse(normalizeJsonQuotes(cancelMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_CANCEL JSON parse falhou:', err.message, '| raw:', cancelMatch[1].slice(0, 200)); }
      clean = clean.replace(cancelMatch[0], '').trim();
    }
  }
  if (!bookingReschedule) {
    const reschedMatch = clean.match(/\[BOOKING_RESCHEDULE\]\s*\n?({[\s\S]*?})/i);
    if (reschedMatch) {
      try { bookingReschedule = JSON.parse(normalizeJsonQuotes(reschedMatch[1])); }
      catch (err) { console.warn('[stripBookingTags] BOOKING_RESCHEDULE JSON parse falhou:', err.message, '| raw:', reschedMatch[1].slice(0, 200)); }
      clean = clean.replace(reschedMatch[0], '').trim();
    }
  }

  // BOOKING_REQUEST (intent legacy) — só limpa, não processa.
  clean = clean.replace(/\[BOOKING_REQUEST\]\s*\n?{[\s\S]*?}/gi, '').trim();
  // Limpa qualquer ruído de colchetes sobrando ("[", "]" isolados em linha)
  clean = clean.replace(/^\s*[\[\]]\s*$/gm, '').trim();

  return { clean, bookingConfirm, bookingCancel, bookingReschedule, handoffHuman };
}

// Remove linguagem de confirmação prematura quando há tag de booking.
// Razão: bot diz "Agendado!" antes da Trinks confirmar. 2-phase: backend constrói msg de sucesso.
const PREMATURE_CONFIRM_PATTERNS = [
  /\b(agendado|confirmado|pronto)\s*!+/gi,
  /\b(agendamento )?(realizado|finalizado|fechado)\b/gi,
  /\bte esperamos\b/gi,
];

function sanitizePrematureConfirm(text) {
  let s = text;
  for (const re of PREMATURE_CONFIRM_PATTERNS) s = s.replace(re, '');
  // Limpa pontuação solta e linhas vazias duplas resultantes
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s || 'Confirmo aqui então 👀';
}

module.exports = {
  normalizeJsonQuotes,
  parseInlineArgs,
  stripBookingTags,
  sanitizePrematureConfirm,
  PREMATURE_CONFIRM_PATTERNS,
};
