/**
 * Sanitiza eco "premium/exclusivo" do Haiku — retry TESS + strip mecânico.
 */

const PREMIUM_RE = /\bpremium\b|exclusivo|top de linha|tabela premium|profissional premium/i;
const TAG_BLOCK_RE = /\[(BOOKING_[A-Z_]+|HANDOFF_HUMAN)[^\]]*\]/gi;

function hasPremiumLeak(text) {
  return PREMIUM_RE.test(String(text || ''));
}

function stripTagsForScan(text) {
  return String(text || '').replace(TAG_BLOCK_RE, '');
}

function premiumOnlyInTags(text) {
  if (!hasPremiumLeak(text)) return false;
  return !hasPremiumLeak(stripTagsForScan(text));
}

function stripPremiumPhrases(text) {
  let out = String(text || '');
  const patterns = [
    /\btabela premium\b/gi,
    /\bprofissional premium\b/gi,
    /\bpremium\b/gi,
    /\bexclusivo\b/gi,
    /\btop de linha\b/gi,
  ];
  for (const re of patterns) {
    out = out.replace(re, '');
  }
  out = out.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

const RETRY_USER_MESSAGE = [
  'REFAÇA a resposta ao cliente.',
  'Proibido: premium, exclusivo, top de linha, "tabela premium", comparar profissionais por preço.',
  'Não ofereça André/Tiago como upgrade se o cliente não pediu alternativa.',
  'No máximo 1–2 horários.',
].join(' ');

/**
 * @param {object} params
 * @param {string} params.tessText
 * @param {() => Promise<string>} params.retryCall
 * @param {string} [params.sessionId]
 * @returns {Promise<{ text: string, sanitized: boolean, method?: string }>}
 */
async function sanitizePremiumResponse({ tessText, retryCall, sessionId = null }) {
  if (!hasPremiumLeak(tessText)) {
    return { text: tessText, sanitized: false };
  }
  if (premiumOnlyInTags(tessText)) {
    return { text: tessText, sanitized: false };
  }

  let retryText = tessText;
  try {
    retryText = await retryCall();
  } catch (err) {
    console.warn(`[${sessionId}] premium retry TESS falhou:`, err.message);
  }

  if (retryText && !hasPremiumLeak(retryText)) {
    return { text: retryText, sanitized: true, method: 'retry' };
  }

  const stripped = stripPremiumPhrases(retryText || tessText);
  console.log(JSON.stringify({
    event: 'tess.premium_sanitized',
    sessionId: sessionId || null,
    method: 'strip',
    timestamp: new Date().toISOString(),
  }));
  return { text: stripped, sanitized: true, method: 'strip' };
}

module.exports = {
  PREMIUM_RE,
  hasPremiumLeak,
  premiumOnlyInTags,
  stripPremiumPhrases,
  sanitizePremiumResponse,
  RETRY_USER_MESSAGE,
};
