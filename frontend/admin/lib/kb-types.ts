/**
 * Client-safe types e pure helpers de KB.
 *
 * Este arquivo NÃO importa `pg`/`db.ts` — pode ser bundleado pro browser.
 * Os helpers de DB ficam em `lib/kb.ts` (server-only).
 */

export const KB_CATEGORIES = ["faq", "servicos", "regras", "padroes", "info"] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];

export interface KbItem {
  id: string;
  slug: string;
  category: KbCategory;
  title: string;
  content_md: string;
  version: number;
  active: boolean;
  tess_memory_id: number | null;
  tess_sync_failed_at: string | null;
  tess_sync_error: string | null;
  updated_by_email: string | null;
  updated_at: string;
  created_at: string;
}

export interface KbVersion {
  id: number;
  kb_item_id: string;
  version: number;
  content_md: string;
  diff_summary: string | null;
  updated_by_email: string | null;
  created_at: string;
}

/** Normaliza slug: lowercase, kebab-case, sem acentos. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Sumário humano-legível de mudança entre 2 textos. */
export function diffSummary(before: string, after: string): string {
  const diff = after.length - before.length;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const absDiff = Math.abs(diff);
  if (absDiff === 0) return "sem mudança no tamanho";
  return `${sign}${absDiff} char${absDiff === 1 ? "" : "s"} (${before.length}→${after.length})`;
}

/** Formato canônico de memory enviada pro TESS. */
export function formatMemoryForTess(opts: { title: string; category: string; content_md: string }): string {
  return `# ${opts.title}\n\n_Categoria: ${opts.category}_\n\n${opts.content_md}`;
}
