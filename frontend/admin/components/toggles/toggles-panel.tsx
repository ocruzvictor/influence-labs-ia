/**
 * TogglesPanel — orquestrador client da página /toggles.
 *
 * Estados:
 *   • toggles + lastEditorEmails (vêm hidratados do Server Component)
 *   • whitelist via useWhitelist (refetch após add/remove)
 *
 * Re-fetch dos toggles após mutação: chama um endpoint GET local-only
 * (não precisa de polling — toggles mudam raramente).
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ToggleRow as ToggleData } from "@/lib/toggles";
import type { WhitelistRow } from "@/lib/whitelist";
import { KillSwitchCard } from "./kill-switch-card";
import { FeaturesCard } from "./features-card";
import { WhitelistCard } from "@/components/whitelist/whitelist-card";

interface Props {
  initialToggles: ToggleData[];
  initialWhitelist: WhitelistRow[];
  lastEditorEmails: Record<string, string | null>;
}

interface ListResponse {
  toggles: ToggleData[];
}

function isListResponse(value: unknown): value is ListResponse {
  if (!value || typeof value !== "object") return false;
  const toggles = (value as { toggles?: unknown }).toggles;
  if (!Array.isArray(toggles)) return false;
  return toggles.every(
    (t) =>
      t !== null &&
      typeof t === "object" &&
      typeof (t as { key?: unknown }).key === "string" &&
      typeof (t as { enabled?: unknown }).enabled === "boolean",
  );
}

export function TogglesPanel({
  initialToggles,
  initialWhitelist,
  lastEditorEmails,
}: Props): React.ReactElement {
  const [toggles, setToggles] = useState<ToggleData[]>(initialToggles);

  const refetchToggles = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/toggles", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      if (!isListResponse(raw)) throw new Error("invalid_response_shape");
      setToggles(raw.toggles);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error";
      toast.error("Falha ao recarregar toggles", { description: msg });
    }
  }, []);

  const globalToggle = toggles.find((t) => t.key === "global");

  return (
    <div className="space-y-5">
      {globalToggle ? (
        <KillSwitchCard
          toggle={globalToggle}
          lastEditorEmail={lastEditorEmails[globalToggle.key] ?? null}
          onMutated={refetchToggles}
        />
      ) : (
        <section className="rounded-md border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
          Kill switch global ainda não configurado. Verifique se a migration 001 foi aplicada e
          existe a row <code>bot_toggles.key=&apos;global&apos;</code> no banco.
        </section>
      )}

      <FeaturesCard toggles={toggles} onMutated={refetchToggles} />

      <WhitelistCard initialItems={initialWhitelist} />
    </div>
  );
}
