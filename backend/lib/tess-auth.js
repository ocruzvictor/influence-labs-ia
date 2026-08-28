/**
 * Headers autenticados da API Tess.
 *
 * A partir de 01/09/2026 o header `x-workspace-id` é obrigatório em requests
 * autenticados (execute, files, memories). Sem ele a Tess responde 422.
 *
 * O valor DEVE ser o workspace associado à TESS_API_TOKEN (não um filtro de
 * agente). Prod Studio Tirrá (Victor 2026-08-28): env TESS_WORKSPACE_ID=1458234.
 * Não hardcodar o ID aqui — 403 histórico (2026-03-09) veio de workspace errado.
 *
 * Story: docs/stories/salon-whatsapp-tess-workspace-id.md
 */

function tessWorkspaceId() {
  const raw = String(process.env.TESS_WORKSPACE_ID || '').trim();
  return /^\d+$/.test(raw) ? raw : null;
}

function tessWorkspaceConfigured() {
  return tessWorkspaceId() !== null;
}

/**
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string>}
 */
function tessAuthHeaders(overrides = {}) {
  const token = process.env.TESS_API_TOKEN;
  const workspaceId = tessWorkspaceId();
  if (!workspaceId) {
    throw new Error(
      'TESS_WORKSPACE_ID ausente ou inválido — obrigatório na API Tess (header x-workspace-id)',
    );
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) headers[key] = value;
  }
  return headers;
}

module.exports = {
  tessAuthHeaders,
  tessWorkspaceId,
  tessWorkspaceConfigured,
};
