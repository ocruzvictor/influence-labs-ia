/**
 * Metadata UI dos toggles — mapping de keys do DB para label + descrição amigáveis.
 *
 * Keys atualmente existentes em `bot_toggles` (migration 001):
 *   • global             — kill switch principal
 *   • feature:audio      — transcrição de áudio
 *   • feature:supervisor — supervisor matinal
 *
 * Fallback: se uma key chegar do backend sem entry no mapping, render com
 * `label = key` literal e `description = ''`, e warn no console em dev.
 * Nunca quebra render.
 */

export interface ToggleMeta {
  label: string;
  description: string;
}

export const TOGGLE_METADATA: Readonly<Record<string, ToggleMeta>> = {
  global: {
    label: "Bot Studio Tirra",
    description: "Desligue para silenciar completamente o bot.",
  },
  "feature:audio": {
    label: "Transcrição de áudio",
    description: "Bot transcreve e responde mensagens de voz.",
  },
  "feature:supervisor": {
    label: "Supervisor matinal",
    description: "Envia resumo diário 8h no WhatsApp do Tiago.",
  },
};

const warned = new Set<string>();

export function getToggleMeta(key: string): ToggleMeta {
  const meta = TOGGLE_METADATA[key];
  if (meta) return meta;
  if (process.env.NODE_ENV !== "production" && !warned.has(key)) {
    warned.add(key);
    console.warn(`[toggles-meta] Sem metadata para toggle key "${key}". Renderizando com fallback.`);
  }
  return { label: key, description: "" };
}

/** Predicado pra split kill-switch vs features. */
export function isFeatureKey(key: string): boolean {
  return key.startsWith("feature:");
}
