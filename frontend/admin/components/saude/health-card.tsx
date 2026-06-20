/**
 * <HealthCard> — card de status de um subsistema do ecossistema.
 *
 * Story 1.7 AC14+AC15+AC16+AC46+AC49.
 *
 * Estados visuais: ok (verde), warn (amarelo), down (vermelho).
 * Acessibilidade: role="status" + aria-live="polite" + label texto além de cor (daltonismo).
 */

import type { CardData } from "@/lib/health-status";
import { Card } from "@/components/ui/card";

const STATUS_STYLES = {
  ok: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    indicator: "🟢",
    border: "border-l-emerald-500",
  },
  warn: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    indicator: "🟡",
    border: "border-l-amber-500",
  },
  down: {
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    indicator: "🔴",
    border: "border-l-rose-500",
  },
} as const;

export function HealthCard({ data }: { data: CardData }): React.ReactElement {
  const style = STATUS_STYLES[data.status];
  return (
    <Card
      role="status"
      aria-live="polite"
      aria-label={`${data.title}: ${data.statusLabel}`}
      className={`p-5 border-l-4 ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-[#1A1A2E]">{data.title}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
        >
          <span aria-hidden>{style.indicator}</span>
          {data.statusLabel}
        </span>
      </div>
      <dl className="space-y-1.5 text-sm">
        {data.metrics.map((m) => (
          <div key={m.label} className="flex min-w-0 items-baseline gap-2">
            <dt className="text-neutral-500 min-w-[5rem]">{m.label}:</dt>
            <dd className="min-w-0 break-words font-mono text-neutral-800">{m.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function HealthCardSkeleton(): React.ReactElement {
  return (
    <Card className="p-5 border-l-4 border-l-neutral-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-6 w-24 rounded bg-neutral-200 animate-pulse" />
        <div className="h-5 w-16 rounded-full bg-neutral-200 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-neutral-200 animate-pulse" />
        <div className="h-4 w-40 rounded bg-neutral-200 animate-pulse" />
      </div>
    </Card>
  );
}
