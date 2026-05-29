"use client";

/**
 * <OverviewPanel> — home (Tela 2, Story 1.6). 3 KPI cards + status do sistema
 * + lista compacta de conversas ativas. KPIs poll 30s; conversas poll 15s.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import type { OverviewResult } from "@/lib/metrics";
import type { ConversationSummary } from "@/lib/conversas";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatRelative } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/metricas/kpi-card";

export function OverviewPanel(): React.ReactElement {
  const [data, setData] = useState<OverviewResult | null>(null);
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as OverviewResult);
    } catch {
      /* mantém últimos dados */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConvs = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/conversas?status=active&limit=5", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { items: ConversationSummary[] };
        setConvs(json.items);
      }
    } catch {
      /* noop */
    }
  }, []);

  usePolling(fetchOverview, 30_000, { pauseOnHidden: true });
  usePolling(fetchConvs, 15_000, { pauseOnHidden: true });

  const unavailable = data ? !data.trinksAvailable : false;
  const lastSuccess = data?.syncStatus?.lastSuccessAt ?? null;
  const syncLabel = lastSuccess
    ? `Sync Trinks: ${formatRelative(lastSuccess)}`
    : "Sync Trinks: aguardando 1º ciclo";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Conversas hoje" kpi={data?.kpis.conversasHoje} loading={loading} goodDirection="up" />
        <KpiCard label="Agendamentos hoje" kpi={data?.kpis.agendamentosHoje} loading={loading} unavailable={unavailable} goodDirection="up" />
        <KpiCard label="No-shows (semana)" kpi={data?.kpis.noShowsSemana} loading={loading} unavailable={unavailable} goodDirection="down" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status do sistema (resumo de 1 linha — não duplica /saude) */}
        <Card className="p-5 border-[rgba(26,26,46,0.08)] bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-zinc-600">Sistema</h2>
          <p className="text-sm text-[#1A1A2E]">
            {data?.botAtivo == null ? (
              <span className="text-zinc-400">Status do bot indisponível</span>
            ) : data.botAtivo ? (
              <span className="font-medium text-emerald-700">🟢 Bot ativo</span>
            ) : (
              <span className="font-medium text-rose-700">🔴 Bot inativo (kill switch)</span>
            )}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{syncLabel}</p>
          <Link href="/saude" className="mt-3 inline-block text-sm text-[#1A1A2E] underline underline-offset-4">
            Ver saúde do sistema →
          </Link>
        </Card>

        {/* Conversas ativas (top 5) */}
        <Card className="p-5 border-[rgba(26,26,46,0.08)] bg-white">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-zinc-600">Conversas ativas</h2>
            <Link href="/conversas" className="text-xs text-zinc-500 underline underline-offset-4">
              Ver todas →
            </Link>
          </div>
          {convs == null ? (
            <p className="text-sm text-zinc-400">Carregando…</p>
          ) : convs.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhuma conversa ativa nas últimas 4h.</p>
          ) : (
            <ul className="space-y-2">
              {convs.map((c) => (
                <li key={c.client_phone}>
                  <Link
                    href={`/conversas?phone=${encodeURIComponent(c.client_phone)}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50"
                  >
                    <span className="font-medium text-[#1A1A2E]">{formatPhone(c.client_phone)}</span>
                    <span className="flex items-center gap-2 text-xs text-zinc-500">
                      {c.had_takeover && <span title="Takeover humano">👤</span>}
                      {c.msg_count} msgs · {formatRelative(c.last_msg_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
