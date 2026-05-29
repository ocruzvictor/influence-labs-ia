"use client";

/**
 * Tab "Saúde" — 4 cards de status + counter + refresh manual.
 *
 * Story 1.7 AC13-AC20. Polling 10s via `usePolling` (pausa em document.hidden).
 * Counter de "Última checagem" usa um interval interno DESLIGADO do poll
 * pra evitar re-render dos cards a cada segundo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/lib/hooks/use-polling";
import { deriveCardStatus, type HealthPayload } from "@/lib/health-status";
import { HealthCard, HealthCardSkeleton } from "./health-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 10_000;

interface State {
  data: HealthPayload | null;
  lastCheckedAt: number | null;
  error: string | null;
  isInitialLoading: boolean;
}

export function HealthTab(): React.ReactElement {
  const [state, setState] = useState<State>({
    data: null,
    lastCheckedAt: null,
    error: null,
    isInitialLoading: true,
  });
  const inFlightRef = useRef(false);

  const fetchHealth = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/saude", { cache: "no-store" });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const payload: HealthPayload = await res.json();
      setState({
        data: payload,
        lastCheckedAt: Date.now(),
        error: null,
        isInitialLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setState((s) => ({ ...s, error: msg, isInitialLoading: false }));
      // Toast só após carga inicial pra evitar barulho no mount
      if (!state.isInitialLoading) {
        toast.error("Erro ao consultar saúde", { description: msg });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [state.isInitialLoading]);

  usePolling(fetchHealth, POLL_INTERVAL_MS);

  if (state.isInitialLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <HealthCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = state.data ? deriveCardStatus(state.data) : [];
  const showBanner = Boolean(state.data?.backend_unreachable);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <LastCheckedCounter lastCheckedAt={state.lastCheckedAt} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchHealth()}
          aria-label="Atualizar saúde agora"
        >
          ↻ Atualizar agora
        </Button>
      </div>

      {showBanner && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <strong>Backend não responde.</strong> Cards refletem último estado
          conhecido ou estado padrão.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <HealthCard key={c.title} data={c} />
        ))}
      </div>
    </div>
  );
}

function LastCheckedCounter({
  lastCheckedAt,
}: {
  lastCheckedAt: number | null;
}): React.ReactElement {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // setTimeout 0 escapa do "synchronous setState in effect" (React 19 / Next 16)
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (!lastCheckedAt || now === null) {
    return <span className="text-sm text-neutral-500">Carregando…</span>;
  }
  const secondsAgo = Math.max(0, Math.floor((now - lastCheckedAt) / 1000));
  return (
    <span
      className="text-sm text-neutral-500"
      aria-live="off"
    >
      Última checagem:{" "}
      <span className="font-mono text-neutral-700">
        {secondsAgo === 0 ? "agora" : `${secondsAgo}s atrás`}
      </span>
    </span>
  );
}
