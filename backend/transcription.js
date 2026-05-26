/**
 * Transcrição de áudio via TESS.
 *
 * Fluxo planejado:
 *   1. Backend recebe webhook Kapso com message.type === 'audio'
 *   2. Baixa bytes do áudio (via media_id que o Kapso/Meta enviou no payload)
 *   3. Upload em TESS via POST /files (multipart) → pega file_id
 *   4. Executa agente de transcrição TESS_TRANSCRIPTION_AGENT_ID passando file_id
 *   5. Recebe texto transcrito (contextualizado pelo prompt do agente — Studio Tirra,
 *      vocabulário do salão, etc.)
 *
 * Status atual: o agente de transcrição ainda NÃO foi criado por Victor na TESS.
 * Enquanto TESS_TRANSCRIPTION_AGENT_ID não está set, a função joga erro estruturado
 * e o handler do webhook responde ao cliente "pode mandar por texto?".
 *
 * Quando Victor criar o agente:
 *   - Set TESS_TRANSCRIPTION_AGENT_ID no .env do VPS
 *   - Possivelmente ajustar formato do input pro agente (mensagem com file_id como anexo)
 *   - A interface da chamada de transcrição é a única coisa que muda — handler já está pronto.
 */

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
 * Baixa bytes de áudio do Kapso pelo media_id.
 * Endpoint inferido do padrão Meta-proxy do Kapso (mesmo padrao de envio: /meta/whatsapp/{ver}/{phone_number_id}/...).
 * Pode precisar ajuste fino quando testarmos com áudio real chegando.
 */
async function downloadAudioFromKapso({ mediaId, phoneNumberId }) {
  if (!mediaId) throw new Error('mediaId ausente');
  if (!phoneNumberId) throw new Error('phoneNumberId ausente para download de media');

  // Padrão Meta Cloud API (Kapso normaliza para o mesmo formato):
  //   1) GET /{media_id} -> retorna { url: "https://lookaside.fbsbx.com/..." }
  //   2) GET nessa URL com Bearer token -> binário
  // Em Kapso, o token é o KAPSO_API_KEY e o endpoint base é api.kapso.ai/meta/whatsapp/...
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
    headers: { Authorization: `Bearer ${TESS_TOKEN}` },
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
 *
 * NOTE: O formato exato de como o agente TESS de transcrição recebe o file_id
 * pode variar dependendo de como Victor configurar:
 *   - Algumas docs sugerem usar field `file_ids: [N]` no body do execute
 *   - Outras sugerem incluir referência no texto da mensagem
 * Implementamos a forma mais provável (file_ids) e fallback (URL/ID inline no prompt).
 * Ajustar quando testarmos com agente real.
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
    headers: { Authorization: `Bearer ${TESS_TOKEN}`, 'Content-Type': 'application/json' },
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
 * Pipeline completo: media_id Kapso → bytes → upload TESS → execute agent → texto.
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

module.exports = { transcribeKapsoAudio, isTranscriptionEnabled };
