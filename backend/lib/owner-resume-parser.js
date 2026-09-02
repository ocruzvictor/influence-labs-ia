/**
 * owner-resume-parser — comando estreito de retomada no thread do dono (story resume-ia-3).
 *
 * Âncoras: retomar | retoma | volta a ia | pode voltar (case-insensitive).
 * Desambiguação 0 / 1 / N handoffs pendentes (silence_reason=handoff, silenced_until > NOW()).
 * Chama resumeConversation(..., actor: 'whatsapp') — não duplica gates.
 */

const { digitsOnly } = require('./owner-access');
const { NOTE_MIN, NOTE_MAX, normalizeNote, resumeConversation } = require('./resume-conversation');

const ANCHOR_PATTERN = /^(?:retomar|retoma|volta\s+a\s+ia|pode\s+voltar)\b/i;
const LEADING_REF_PATTERN = /^(\d{10,15}|[\p{L}][\p{L}\s'-]{0,40})\s*[.:]\s*/iu;
const PHONE_IN_TEXT_PATTERN = /\d{10,15}/g;

/**
 * @param {string} text
 * @returns {boolean}
 */
function matchesResumeAnchor(text) {
  return ANCHOR_PATTERN.test(String(text || '').trim());
}

/**
 * @param {string} text
 * @returns {string}
 */
function extractAfterAnchor(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(ANCHOR_PATTERN);
  if (!match) return '';
  return trimmed.slice(match.index + match[0].length).trim();
}

/**
 * Remove referência inicial opcional (nome ou telefone) antes da nota.
 *
 * @param {string} remainder
 * @returns {string}
 */
function stripLeadingReference(remainder) {
  let rest = String(remainder || '').trim();
  const refMatch = rest.match(LEADING_REF_PATTERN);
  if (refMatch) {
    rest = rest.slice(refMatch[0].length).trim();
  }
  return rest;
}

/**
 * @param {string} remainder
 * @returns {{ ok: true, note: string } | { ok: false, error: 'missing_note' }}
 */
function extractNoteFromRemainder(remainder) {
  const note = normalizeNote(stripLeadingReference(remainder));
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    return { ok: false, error: 'missing_note' };
  }
  return { ok: true, note };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractPhonesFromText(text) {
  const matches = String(text || '').match(PHONE_IN_TEXT_PATTERN) || [];
  return [...new Set(matches.map((m) => digitsOnly(m)).filter(Boolean))];
}

/**
 * @param {object} db
 * @returns {Promise<Array<{ phone: string, name: string|null }>>}
 */
async function queryPendingHandoffs(db) {
  const result = await db.query(
    `SELECT b.phone, c.name
       FROM bot_thread_state b
       LEFT JOIN clients c ON c.phone = b.phone
      WHERE b.silence_reason = 'handoff'
        AND b.silenced_until > NOW()
      ORDER BY b.silenced_until DESC`,
  );
  if (!result?.rows) return [];
  return result.rows.map((row) => ({
    phone: digitsOnly(row.phone),
    name: row.name ? String(row.name).trim() : null,
  }));
}

/**
 * @param {string} text
 * @param {Array<{ phone: string }>} pendings
 * @returns {string|null}
 */
function matchPendingByPhone(text, pendings) {
  const pendingSet = new Set(pendings.map((p) => p.phone));
  const phones = extractPhonesFromText(text);
  const hits = phones.filter((p) => pendingSet.has(p));
  if (hits.length === 1) return hits[0];
  return null;
}

/**
 * @param {string} text
 * @param {Array<{ phone: string, name: string|null }>} pendings
 * @returns {'none'|'one'|'ambiguous'|string}
 */
function matchPendingByName(text, pendings) {
  const haystack = String(text || '').toLowerCase();
  const hits = pendings.filter((p) => {
    if (!p.name) return false;
    return haystack.includes(String(p.name).toLowerCase());
  });
  if (hits.length === 1) return hits[0].phone;
  if (hits.length === 0) return 'none';
  return 'ambiguous';
}

/**
 * @param {object} opts
 * @param {string} opts.fullText
 * @param {string} opts.remainder
 * @param {Array<{ phone: string, name: string|null }>} opts.pendings
 * @returns {{ ok: true, phone: string } | { ok: false, reason: 'none_pending'|'ambiguous', pendings: object[] }}
 */
function resolveTargetPhone({ fullText, remainder, pendings }) {
  if (!pendings.length) {
    return { ok: false, reason: 'none_pending', pendings: [] };
  }
  if (pendings.length === 1) {
    return { ok: true, phone: pendings[0].phone };
  }

  const byPhone = matchPendingByPhone(fullText, pendings);
  if (byPhone) return { ok: true, phone: byPhone };

  const byName = matchPendingByName(`${fullText} ${remainder}`, pendings);
  if (byName !== 'none' && byName !== 'ambiguous') {
    return { ok: true, phone: byName };
  }

  return { ok: false, reason: 'ambiguous', pendings };
}

/**
 * @param {Array<{ phone: string, name: string|null }>} pendings
 * @returns {string}
 */
function formatPendingList(pendings) {
  return pendings
    .map((p) => {
      const label = p.name ? `${p.name} (${p.phone})` : p.phone;
      return `• ${label}`;
    })
    .join('\n');
}

/**
 * @param {{ httpStatus: number, body: object }} result
 * @returns {string}
 */
function formatResumeResultAck(result) {
  const { httpStatus, body } = result || {};
  const status = body?.status;
  const error = body?.error;

  if (httpStatus === 200) {
    if (status === 'sent') return 'Retomada enviada para a cliente.';
    if (status === 'window_closed') {
      return 'Janela 24h fechada — orientação guardada; a IA retoma quando a cliente escrever.';
    }
    if (status === 'already_active') return 'Thread já ativa (sem handoff pendente).';
  }

  if (httpStatus === 400) {
    if (error === 'invalid_note') return 'Falta a orientação (20–500 caracteres após retomar.).';
    if (error === 'invalid_phone') return 'Telefone inválido na retomada.';
    return 'Comando inválido — verifique telefone e orientação.';
  }

  if (httpStatus === 409) {
    if (error === 'human_spoke_recently') return 'Recepção falou há pouco — aguarde ~10 min e tente de novo.';
    if (error === 'human_only') return 'Bot pausado (human_only) — retome pelo admin.';
    if (error === 'blocked') return 'Cliente bloqueada — não dá para retomar.';
    return 'Retomada recusada — conflito com operação humana recente.';
  }

  if (httpStatus === 422) {
    if (error === 'tess_rehandoff') return 'TESS pediu handoff de novo — thread silenciada.';
    return 'TESS não conseguiu retomar — tente outra orientação ou use o admin.';
  }

  if (httpStatus === 503) {
    if (error === 'kapso_send_failed') return 'Falha ao enviar pelo WhatsApp — tente de novo.';
    if (error === 'db_unavailable') return 'Banco indisponível — tente em instantes.';
    return 'Serviço indisponível — tente de novo.';
  }

  return 'Não foi possível retomar — tente de novo ou use o admin.';
}

/**
 * @param {boolean} isOwner
 * @param {string} messageText
 * @returns {boolean}
 */
function shouldAttemptOwnerResume(isOwner, messageText) {
  return Boolean(isOwner) && matchesResumeAnchor(messageText);
}

/**
 * @param {object} opts
 * @param {string} opts.messageText
 * @param {object} opts.db
 * @param {object} opts.resumeDeps deps para resumeConversation
 * @param {(text: string) => Promise<void>} opts.sendAck
 * @returns {Promise<{ handled: boolean }>}
 */
async function handleOwnerResumeInbound({ messageText, db, resumeDeps, sendAck }) {
  if (!matchesResumeAnchor(messageText)) {
    return { handled: false };
  }

  const remainder = extractAfterAnchor(messageText);
  const noteResult = extractNoteFromRemainder(remainder);
  if (!noteResult.ok) {
    await sendAck('Falta a orientação (20–500 caracteres após retomar.).');
    return { handled: true };
  }

  const pendings = await queryPendingHandoffs(db);
  const target = resolveTargetPhone({
    fullText: messageText,
    remainder,
    pendings,
  });

  if (!target.ok) {
    if (target.reason === 'none_pending') {
      await sendAck('Nenhum handoff pendente agora.');
    } else {
      const list = formatPendingList(target.pendings);
      await sendAck(
        `Vários handoffs pendentes — informe telefone ou nome:\n${list}`,
      );
    }
    return { handled: true };
  }

  const result = await resumeConversation(
    target.phone,
    { note: noteResult.note, actor: 'whatsapp' },
    resumeDeps,
  );
  await sendAck(formatResumeResultAck(result));
  return { handled: true };
}

module.exports = {
  ANCHOR_PATTERN,
  NOTE_MIN,
  NOTE_MAX,
  matchesResumeAnchor,
  extractAfterAnchor,
  stripLeadingReference,
  extractNoteFromRemainder,
  extractPhonesFromText,
  queryPendingHandoffs,
  matchPendingByPhone,
  matchPendingByName,
  resolveTargetPhone,
  formatPendingList,
  formatResumeResultAck,
  shouldAttemptOwnerResume,
  handleOwnerResumeInbound,
};
