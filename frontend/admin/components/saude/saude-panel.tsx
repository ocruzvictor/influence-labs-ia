"use client";

/**
 * Orchestrator da rota /saude — Tabs (Saúde | Auditoria) com URL state.
 *
 * Story 1.7 AC11+AC12. URL `?tab=` é fonte da verdade.
 * Click em tab → router.replace (sem history pollution).
 */

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HealthTab } from "./health-tab";
import { AuditTab } from "./audit-tab";

type Tab = "saude" | "auditoria";

const VALID_TABS: ReadonlySet<Tab> = new Set(["saude", "auditoria"]);

function parseTab(value: string | null): Tab {
  return value && VALID_TABS.has(value as Tab) ? (value as Tab) : "saude";
}

export function SaudePanel({
  initialTab,
}: {
  initialTab: Tab;
}): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab")) || initialTab;

  const handleChange = useCallback(
    (value: string) => {
      const next = parseTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/saude?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <Tabs value={currentTab} onValueChange={handleChange} className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="saude">Saúde</TabsTrigger>
        <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
      </TabsList>
      <TabsContent value="saude">
        <HealthTab />
      </TabsContent>
      <TabsContent value="auditoria">
        <AuditTab />
      </TabsContent>
    </Tabs>
  );
}
