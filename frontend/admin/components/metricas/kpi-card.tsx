/**
 * <KpiCard> — card numérico do dashboard de métricas (Story 1.6, AC23/AC28).
 *
 * Estados: loading (skeleton), unavailable ("Aguardando sync Trinks" — AC19), normal.
 * Trend direcional: `goodDirection` define se ↑ é verde (agendamentos) ou vermelho
 * (no-show/cancelamento/takeover).
 */

import type { Kpi } from "@/lib/metrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  label: string;
  kpi?: Kpi | null;
  suffix?: string; // ex: "%"
  sub?: string | null; // linha secundária (ex: "6.4% (target <8%)")
  unavailable?: boolean; // Trinks sem dados
  loading?: boolean;
  goodDirection?: "up" | "down"; // direção "boa" pro trend (default up)
}

function trendText(kpi: Kpi): { text: string; positive: boolean } | null {
  if (!kpi.trend) return null;
  const { delta, pct } = kpi.trend;
  if (delta === 0) return { text: "estável", positive: true };
  const arrow = delta > 0 ? "↑" : "↓";
  const body = pct !== null ? `${Math.abs(Math.round(pct))}%` : `${Math.abs(delta)}`;
  return { text: `${arrow} ${body}`, positive: delta > 0 };
}

export function KpiCard({
  label,
  kpi,
  suffix = "",
  sub = null,
  unavailable = false,
  loading = false,
  goodDirection = "up",
}: KpiCardProps): React.ReactElement {
  return (
    <Card className="p-5 border-[rgba(26,26,46,0.08)] bg-white">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-20" />
      ) : unavailable || kpi == null || kpi.value == null ? (
        <p className="mt-3 text-sm text-zinc-400" role="status">
          Aguardando sync Trinks
        </p>
      ) : (
        <>
          <Render kpi={kpi} suffix={suffix} goodDirection={goodDirection} />
          {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
        </>
      )}
    </Card>
  );
}

function Render({
  kpi,
  suffix,
  goodDirection,
}: {
  kpi: Kpi;
  suffix: string;
  goodDirection: "up" | "down";
}): React.ReactElement {
  const t = trendText(kpi);
  // "positive" do trend = subiu; "bom" depende da direção desejada.
  const isGood = t ? (goodDirection === "up" ? t.positive : !t.positive) : true;
  return (
    <>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[#1A1A2E]">
        {kpi.value}
        {suffix && <span className="text-xl">{suffix}</span>}
      </p>
      {t && (
        <p
          className={`mt-1 text-xs font-medium ${
            t.text === "estável" ? "text-zinc-400" : isGood ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {t.text} <span className="text-zinc-400">vs período anterior</span>
        </p>
      )}
    </>
  );
}
