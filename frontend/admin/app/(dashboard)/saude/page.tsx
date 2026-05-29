/**
 * /saude — Saúde + Auditoria (combinada).
 *
 * Story 1.7. Server Component que lê ?tab= e renderiza o panel client.
 * Auth: proxy.ts já valida; layout (dashboard) re-valida via getCurrentUser.
 */

import { SaudePanel } from "@/components/saude/saude-panel";

type Tab = "saude" | "auditoria";

export default async function SaudePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<React.ReactElement> {
  const sp = await searchParams;
  const initialTab: Tab = sp.tab === "auditoria" ? "auditoria" : "saude";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#1A1A2E]">
          Saúde + Auditoria
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Status do ecossistema e rastro de mudanças do painel.
        </p>
      </header>
      <SaudePanel initialTab={initialTab} />
    </div>
  );
}
