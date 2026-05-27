/**
 * /conversas/[phone] — drill-down de uma conversa.
 *
 * Server Component:
 *   • Valida formato do phone (regex /^\d{10,15}$/) antes de qualquer fetch
 *   • Pre-fetch do client (clients table) + summary (msg_count + first_msg_at)
 *   • Renderiza header com phone formatado + nome se disponível
 *   • Hidrata <ConversationTimeline> client component
 *   • Sidebar (desktop) com dados + stubs disabled
 *
 * AC25 (phone inexistente) — API retorna messages=[], UI mostra empty state
 * AC26 (phone formato inválido) — validação aqui retorna 400 visualmente
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { listConversations } from "@/lib/conversas";
import { getClientByPhone } from "@/lib/clients";
import { formatPhone } from "@/lib/format/phone";
import { ConversationTimeline } from "@/components/conversas/conversation-timeline";
import { ClientSidebar } from "@/components/conversas/client-sidebar";

export const dynamic = "force-dynamic";

const PHONE_REGEX = /^\d{10,15}$/;

interface PageProps {
  params: Promise<{ phone: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function ConversaDrilldownPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { phone } = await params;
  const sp = await searchParams;

  // AC26 — formato inválido retorna 404 (semanticamente é 400, mas notFound dá UX limpo)
  if (!PHONE_REGEX.test(phone)) {
    notFound();
  }

  // Pre-fetch em paralelo: cliente + summary (pra msg_count e first_msg_at)
  const [client, summary] = await Promise.all([
    getClientByPhone(phone).catch(() => null),
    listConversations({
      status: "all",
      takeover: "all",
      search: phone,
      cursor: null,
      limit: 1,
    })
      .then((r) => r.items.find((i) => i.client_phone === phone) ?? null)
      .catch(() => null),
  ]);

  const backHref = sp.from ? `/conversas?${sp.from}` : "/conversas";
  const headerName = client?.name ? ` · ${client.name}` : "";

  return (
    <div className="flex h-[calc(100vh-3.5rem-4rem)] flex-col space-y-4">
      <header className="flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Conversa</p>
          <h1 className="font-mono text-lg font-semibold text-[#1A1A2E] sm:text-xl">
            {formatPhone(phone)}
            <span className="font-sans text-base font-normal text-zinc-700">{headerName}</span>
          </h1>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white">
          <ConversationTimeline phone={phone} />
        </section>

        <div className="hidden lg:block">
          <ClientSidebar
            phone={phone}
            client={client}
            msgCount={summary?.msg_count ?? null}
            firstMsgAt={summary?.first_msg_at ?? null}
          />
        </div>
      </div>
    </div>
  );
}
