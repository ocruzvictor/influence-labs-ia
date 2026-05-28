/**
 * /kb — Knowledge Base editor.
 *
 * Server Component:
 *   • Pre-fetch items via lib/kb.ts
 *   • Hidrata client orchestrator <KbPanel>
 *   • Mostra warning banner se TIRRA_KB_COLLECTION_ID não configurado
 *
 * Story: 1.5 (KB editor — Caminho B)
 */

import { Suspense } from "react";
import { listKbItems } from "@/lib/kb";
import { env } from "@/lib/env";
import { KbPanel } from "@/components/kb/kb-panel";

export const dynamic = "force-dynamic";

export default async function KbPage(): Promise<React.ReactElement> {
  const items = await listKbItems().catch((err: unknown) => {
    console.error("[KbPage] listKbItems failed:", err);
    return [];
  });

  const kbConfigured = Boolean(env.TIRRA_KB_COLLECTION_ID);
  const itemsWithFailedSync = items.filter((i) => i.tess_sync_failed_at !== null).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Painel admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1A1A2E]">Base de conhecimento</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Edite o conhecimento que o agente consulta em cada conversa. Mudanças refletem na próxima mensagem.
        </p>
      </header>

      {!kbConfigured && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">⚠️ KB não configurada</p>
          <p className="mt-1">
            <code className="text-xs">TIRRA_KB_COLLECTION_ID</code> não está setado em{" "}
            <code className="text-xs">infra/.env</code>. Edições aqui retornam erro 503. Rode{" "}
            <code className="text-xs">scripts/bootstrap-tess-kb.mjs</code> primeiro.
          </p>
        </div>
      )}

      {itemsWithFailedSync > 0 && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-medium">
            ⚠️ {itemsWithFailedSync} {itemsWithFailedSync === 1 ? "item dessincronizado" : "items dessincronizados"} com TESS
          </p>
          <p className="mt-1">
            Os items aparecem destacados na lista. Próxima edição tenta sincronizar novamente.
          </p>
        </div>
      )}

      <Suspense fallback={null}>
        <KbPanel initialItems={items} kbConfigured={kbConfigured} />
      </Suspense>
    </div>
  );
}
