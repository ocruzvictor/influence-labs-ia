/**
 * /conversas — lista de conversas live.
 *
 * Server Component:
 *   • Pre-fetch da primeira página (SSR) para FCP rápido
 *   • Pre-fetch dos nomes de clientes (clients table) por phone
 *   • Hidrata <ConversationList> client component com initial data
 *
 * Proxy.ts já garante auth — não precisamos checar aqui (defesa em
 * profundidade fica no layout do (dashboard) que já chama getCurrentUser).
 */

import { Suspense } from "react";
import { listConversations } from "@/lib/conversas";
import { query } from "@/lib/db";
import { ConversationList } from "@/components/conversas/conversation-list";

export const dynamic = "force-dynamic";

interface DbNameRow {
  phone: string;
  name: string | null;
}

async function fetchNamesByPhone(phones: string[]): Promise<Record<string, string | null>> {
  if (phones.length === 0) return {};
  const rows = await query<DbNameRow>(
    `SELECT phone, name FROM clients WHERE phone = ANY($1::text[])`,
    [phones],
  );
  const map: Record<string, string | null> = {};
  for (const r of rows) map[r.phone] = r.name;
  return map;
}

export default async function ConversasPage(): Promise<React.ReactElement> {
  // Pré-fetch da primeira página com filtros default
  let initialItems: Awaited<ReturnType<typeof listConversations>>["items"] = [];
  let initialNamesByPhone: Record<string, string | null> = {};
  try {
    const initial = await listConversations({
      status: "all",
      takeover: "all",
      search: null,
      cursor: null,
      limit: 50,
    });
    initialItems = initial.items;
    initialNamesByPhone = await fetchNamesByPhone(initial.items.map((i) => i.client_phone));
  } catch {
    // Silencia — client component refaz fetch e mostra erro próprio
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Painel admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1A1A2E]">Conversas</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Lista live com polling a cada 5 segundos. Clique numa conversa para abrir a timeline.
        </p>
      </header>

      <Suspense fallback={null}>
        <ConversationList initialNamesByPhone={initialNamesByPhone} />
      </Suspense>

      {/* SSR snapshot — apenas referência; ConversationList re-fetcha no client */}
      <noscript>
        <p className="text-sm text-zinc-600">
          A lista requer JavaScript habilitado para receber atualizações em tempo real.
          {initialItems.length > 0 ? ` (${initialItems.length} conversas carregadas)` : null}
        </p>
      </noscript>
    </div>
  );
}
