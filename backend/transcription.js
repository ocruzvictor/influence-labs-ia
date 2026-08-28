/**
 * Transcrição de áudio.
 *
 * Estratégia: Kapso-primary, TESS-fallback.
 *
 * O Kapso já transcreve áudios do WhatsApp gratuitamente e injeta o texto no
 * campo `kapso.content` do payload do webhook como:
 *
 *   "Audio attached (audio_XXX.ogg) [Size: 12.1 KB | Type: audio/opus] URL: <url>
 *    Transcript: <texto transcrito>"
 *
 * Caminho primário (zero custo, ~0ms extra):
 *   extractKapsoTranscript(kapso.content) extrai o que vem após "Transcript: "
 *   e usa direto. 100% dos áudios em prod hoje resolvem por esse caminho.
 *
 * Caminho fallback (custo TESS, 5-15s extra):
 *   Só executa se kapso.content não contém Transcript: (ex: áudio enviado por
 *   canal Meta direto sem auto-transcrição, ou Kapso falhou em transcrever).
 *   Pipeline: download media via Kapso → upload TESS /files → execute agent.
 *
 * NOTA — endpoint /meta/whatsapp/{ver}/{media_id} retorna 404 em prod
 * ("WhatsApp configuration not found"). Fallback TESS portanto só vai funcionar
 * quando esse endpoint for resolvido. Hoje, na prática, 100% dos áudios são
 * resolvidos pelo caminho Kapso-primary — o 404 é silencioso e inofensivo.
 */

const { tessAuthHeaders } = require('./lib/tess-auth');

const TESS_API_BASE = (process.env.TESS_API_BASE || 'https://api.tess.im').replace(/\/+$/, '');
const TESS_TOKEN = process.env.TESS_API_TOKEN;
const TRANSCRIPTION_AGENT_ID = process.env.TESS_TRANSCRIPTION_AGENT_ID || '';
const KAPSO_API_BASE = (process.env.KAPSO_API_BASE || 'https://api.kapso.ai').replace(/\/+$/, '');
const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_API_VERSION = process.env.KAPSO_API_VERSION || 'v24.0';

function isTranscriptionEnabled() {
  return Boolean(TRANSCRIPTION_AGENT_ID && TESS_TOKEN);
}

/**
 * Extrai o texto transcrito do campo kapso.content quando Kapso já transcreveu.
 * Retorna null se não houver Transcript: ou se o texto capturado for vazio.
 *
 * Tolerante a variação de capitalização, espaços ao redor de ":", e captura
 * texto multilinha até o fim da string.
 */
function extractKapsoTranscript(kapsoContent) {
  if (!kapsoContent || typeof kapsoContent !== 'string') return null;
  const match = kapsoContent.match(/transcript\s*:\s*([\s\S]+)$/i);
  if (!match) return null;
  const text = match[1].trim();
  return text ? text : null;
}

/**
 * Baixa bytes de áudio do Kapso pelo media_id.
 * Endpoint inferido do padrão Meta-proxy do Kapso. Retorna 404 em prod hoje —
 * ver dívida #1 no runbook. Função usada apenas no fallback TESS.
 */
async function downloadAudioFromKapso({ mediaId, phoneNumberId }) {
  if (!mediaId) throw new Error('mediaId ausente');
  if (!phoneNumberId) throw new Error('phoneNumberId ausente para download de media');

  const metaUrl = `${KAPSO_API_BASE}/meta/whatsapp/${KAPSO_API_VERSION}/${mediaId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { 'X-API-Key': KAPSO_API_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!metaRes.ok) {
    throw new Error(`Kapso media metadata failed: ${metaRes.status} ${await metaRes.text().catch(() => '')}`);
  }
  const meta = await metaRes.json();
  const downloadUrl = meta.url;
  if (!downloadUrl) throw new Error('media metadata sem campo url');

  const bytesRes = await fetch(downloadUrl, {
    headers: { 'X-API-Key': KAPSO_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!bytesRes.ok) throw new Error(`Kapso media download failed: ${bytesRes.status}`);
  const buffer = Buffer.from(await bytesRes.arrayBuffer());
  return { buffer, mimeType: meta.mime_type || 'audio/ogg' };
}

/**
 * Upload de arquivo na TESS — POST /files multipart.
 * Retorna file_id (campo `id` da response).
 */
async function uploadFileToTess({ buffer, filename, mimeType }) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  form.append('process', 'true');
  const res = await fetch(`${TESS_API_BASE}/files`, {
    method: 'POST',
    headers: tessAuthHeaders(),
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`TESS upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  const json = await res.json();
  if (!json.id) throw new Error('TESS upload sem field id');
  return json.id;
}

/**
 * Executa o agente de transcrição passando o file_id como referência.
 */
async function executeTranscriptionAgent({ fileId }) {
  const body = {
    messages: [
      { role: 'user', content: `Transcreva o audio anexado. Contexto: Studio Tirra (salao de beleza em Sao Caetano do Sul, SP). Retorne APENAS o texto transcrito, sem prefacios. file_id=${fileId}` },
    ],
    file_ids: [fileId],
    wait_execution: true,
  };
  const res = await fetch(`${TESS_API_BASE}/agents/${TRANSCRIPTION_AGENT_ID}/execute`, {
    method: 'POST',
    headers: tessAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`TESS transcription failed: ${res.status} ${await res.text().catch(() => '')}`);
  const json = await res.json();
  const text = json?.responses?.[0]?.output;
  if (!text || !text.trim()) throw new Error('TESS transcription sem output');
  return text.trim();
}

/**
 * Pipeline TESS completo (fallback): media_id Kapso → bytes → upload TESS → execute agent → texto.
 * Joga erro estruturado em qualquer ponto.
 */
async function transcribeKapsoAudio({ mediaId, phoneNumberId }) {
  if (!isTranscriptionEnabled()) {
    const err = new Error('TESS_TRANSCRIPTION_AGENT_ID nao configurado');
    err.code = 'transcription_not_configured';
    throw err;
  }
  const { buffer, mimeType } = await downloadAudioFromKapso({ mediaId, phoneNumberId });
  const fileId = await uploadFileToTess({
    buffer,
    filename: `audio-${mediaId}.${mimeType.includes('opus') ? 'ogg' : 'mp3'}`,
    mimeType,
  });
  const text = await executeTranscriptionAgent({ fileId });
  return { text, fileId, mimeType, bytes: buffer.length };
}

/**
 * Entrada principal de transcrição. Decide entre Kapso-primary e TESS-fallback.
 *
 * @param {Object} args
 * @param {string} args.mediaId         media_id do Kapso/Meta (pra fallback TESS)
 * @param {string} args.phoneNumberId   phone_number_id da conexão (pra fallback TESS)
 * @param {string} [args.kapsoContent]  campo kapso.content do payload — preferido
 * @returns {Promise<{text: string, source: 'kapso'|'tess', bytes?: number, fileId?: string, mimeType?: string}>}
 */
async function transcribeAudio({ mediaId, phoneNumberId, kapsoContent }) {
  const kapsoText = extractKapsoTranscript(kapsoContent);
  if (kapsoText) {
    return { text: kapsoText, source: 'kapso' };
  }
  const result = await transcribeKapsoAudio({ mediaId, phoneNumberId });
  return { ...result, source: 'tess' };
}

module.exports = {
  transcribeAudio,
  transcribeKapsoAudio,
  extractKapsoTranscript,
  isTranscriptionEnabled,
};
