/**
 * /toggles — Kill switch global + Features + Whitelist por número.
 *
 * Server Component:
 *   • Pre-fetch toggles + whitelist + emails dos last editors
 *   • Hidrata client orchestrator <TogglesPanel>
 */

import { Suspense } from "react";
import { listToggles } from "@/lib/toggles";
import { listWhitelist } from "@/lib/whitelist";
import { query } from "@/lib/db";
import { TogglesPanel } from "@/components/toggles/toggles-panel";

export const dynamic = "force-dynamic";

interface DbEditorRow {
  toggle_key: string;
  email: string | null;
}

/**
 * Resolve `updated_by` (UUID) → email via JOIN. Lib/toggles atual não traz isso
 * pra evitar acoplar admin_users no helper genérico. Aqui na page (server-side)
 * fazemos a query auxiliar.
 */
async function fetchLastEditorEmails(): Promise<Record<string, string | null>> {
  const rows = await query<DbEditorRow>(
    `SELECT bt.key AS toggle_key, u.email
       FROM bot_toggles bt
       LEFT JOIN admin_users u ON u.id = bt.updated_by`,
  );
  const map: Record<string, string | null> = {};
  for (const r of rows) map[r.toggle_key] = r.email;
  return map;
}

export default async function TogglesPage(): Promise<React.ReactElement> {
  // Pre-fetch em paralelo. Errors são logados server-side em vez de silenciados —
  // page renderiza com fallback vazio e client component faz refetch que vai
  // exibir toast se persistir (UI não trava). Logs vão pro stdout do container.
  const [toggles, whitelist, lastEditors] = await Promise.all([
    listToggles().catch((err: unknown) => {
      console.error("[TogglesPage] listToggles failed:", err);
      return [];
    }),
    listWhitelist().catch((err: unknown) => {
      console.error("[TogglesPage] listWhitelist failed:", err);
      return [];
    }),
    fetchLastEditorEmails().catch((err: unknown) => {
      console.error("[TogglesPage] fetchLastEditorEmails failed:", err);
      return {} as Record<string, string | null>;
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Painel admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1A1A2E]">Toggles</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kill switch global, features do bot e whitelist por número. Mudanças propagam em até 5
          segundos no fluxo de mensagens.
        </p>
      </header>

      <Suspense fallback={null}>
        <TogglesPanel
          initialToggles={toggles}
          initialWhitelist={whitelist}
          lastEditorEmails={lastEditors}
        />
      </Suspense>
    </div>
  );
}
