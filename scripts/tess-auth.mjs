/** Headers Tess: Bearer + x-workspace-id (obrigatório 01/09/2026). */

export function tessScriptHeaders(extra = {}) {
  const token = process.env.TESS_API_TOKEN;
  const workspaceId = String(process.env.TESS_WORKSPACE_ID || '').trim();
  if (!token) {
    throw new Error('TESS_API_TOKEN não setado');
  }
  if (!/^\d+$/.test(workspaceId)) {
    throw new Error('TESS_WORKSPACE_ID ausente ou inválido (só dígitos)');
  }
  return {
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
    ...extra,
  };
}
