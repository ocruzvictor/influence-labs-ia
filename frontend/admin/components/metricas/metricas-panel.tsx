"use client";

/**
 * <MetricasPanel> — Tela 5 (Story 1.6). Period selector + 6 KPI cards + bar chart
 * + top profissionais. Polling 30s pausável. URL (?period=) é fonte da verdade.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { MetricsResult, Period } from "@/lib/metrics";
import { usePolling } from "@/lib/hooks/use-polling";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "./kpi-card";
import { AgendamentosChart } from "./agendamentos-chart";

const PERIOD_LABELS: Record<Period, string> = {
  "24h": "Últimas 24h",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

export function MetricasPanel({ initialPeriod }: { initialPeriod: Period }): React.ReactElement {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<MetricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(
    async (p: Period, fresh = false): Promise<void> => {
      try {
        const res = await fetch(`/api/metricas?period=${p}${fresh ? "&fresh=1" : ""}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MetricsResult;
        setData(json);
        setError(null);
      } catch {
        setError("Erro ao consultar métricas");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  usePolling(() => fetchMetrics(period), 30_000, { pauseOnHidden: true });

  const onPeriodChange = (p: Period): void => {
    setPeriod(p);
    setLoading(true);
    router.replace(`/metricas?period=${p}`, { scroll: false });
    void fetchMetrics(p);
  };

  const unavailable = data ? !data.trinksAvailable : false;
  const failing = data ? data.syncStatus.consecutiveFailures >= 3 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Painel</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#1A1A2E]">Métricas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
            <SelectTrigger className="w-[170px]" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar agora"
            onClick={() => {
              setLoading(true);
              void fetchMetrics(period, true);
            }}
          >
            ↻
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}. Mostrando últimos dados disponíveis.
        </div>
      )}
      {failing && (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠️ Sync Trinks com falhas ({data?.syncStatus.lastError ?? "erro"}). Dados podem estar defasados.
        </div>
      )}

      {/* KPI cards (AC23) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Agendamentos" kpi={data?.kpis.agendamentos} loading={loading} unavailable={unavailable} goodDirection="up" />
        <KpiCard label="Taxa de sucesso bot" kpi={data?.kpis.taxaSucesso} suffix="%" loading={loading} unavailable={unavailable} goodDirection="up" />
        <KpiCard label="Takeovers humanos" kpi={data?.kpis.takeovers} loading={loading} goodDirection="down" />
        <KpiCard
          label="No-shows"
          kpi={data?.kpis.noShows}
          loading={loading}
          unavailable={unavailable}
          goodDirection="down"
          sub={data?.noShowRatePct != null ? `${data.noShowRatePct}% (meta < 8%)` : null}
        />
        <KpiCard label="Cancelamentos" kpi={data?.kpis.cancelamentos} loading={loading} unavailable={unavailable} goodDirection="down" />
        <KpiCard label="Msgs / dia (média)" kpi={data?.kpis.msgsDia} loading={loading} goodDirection="up" />
      </div>

      {/* Chart (AC24) */}
      <Card className="p-5 border-[rgba(26,26,46,0.08)] bg-white">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em] text-zinc-600">
          Agendamentos por dia
        </h2>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : unavailable || !data?.serieAgendamentos.length ? (
          <EmptyTrinks />
        ) : (
          <AgendamentosChart data={data.serieAgendamentos} />
        )}
      </Card>

      {/* Top profissionais (AC25) */}
      <Card className="p-5 border-[rgba(26,26,46,0.08)] bg-white">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em] text-zinc-600">
          Top profissionais ({PERIOD_LABELS[period].toLowerCase()})
        </h2>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : unavailable || !data?.topProfissionais?.length ? (
          <EmptyTrinks />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-right">Agendamentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topProfissionais.map((p, i) => (
                <TableRow key={`${p.professional_name}-${i}`}>
                  <TableCell className="font-medium text-[#1A1A2E]">{p.professional_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EmptyTrinks(): React.ReactElement {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-zinc-400" role="status">
      Aguardando primeiro sync Trinks
    </div>
  );
}
