/**
 * /metricas — dashboard de métricas (Tela 5, Story 1.6).
 *
 * Server Component que lê ?period= e renderiza o panel client.
 * Auth: proxy.ts valida; layout (dashboard) re-valida via getCurrentUser.
 */

import { MetricasPanel } from "@/components/metricas/metricas-panel";
import type { Period } from "@/lib/metrics";

const VALID: ReadonlyArray<Period> = ["24h", "7d", "30d", "90d"];

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}): Promise<React.ReactElement> {
  const sp = await searchParams;
  const initialPeriod: Period = VALID.includes(sp.period as Period) ? (sp.period as Period) : "7d";

  return <MetricasPanel initialPeriod={initialPeriod} />;
}
