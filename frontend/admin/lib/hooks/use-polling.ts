/**
 * usePolling — invoca `fn` repetidamente em intervalos.
 *
 * Comportamento:
 *   • Roda `fn()` no mount.
 *   • Agenda próxima execução após `intervalMs`.
 *   • Pausa quando aba está hidden (Page Visibility API) e retoma ao voltar.
 *   • Cleanup robusto em unmount.
 *   • Não dispara overlap: se `fn` for async, espera resolver antes de reagendar.
 *
 * Uso:
 *   usePolling(fetchData, 5000);
 *   usePolling(fetchData, 5000, { pauseOnHidden: false });
 */

"use client";

import { useEffect, useRef } from "react";

interface PollingOptions {
  pauseOnHidden?: boolean;
  /** Não invoca `fn` na primeira renderização — só após `intervalMs`. */
  skipInitial?: boolean;
}

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  options: PollingOptions = {},
): void {
  const { pauseOnHidden = true, skipInitial = false } = options;
  const fnRef = useRef(fn);

  // Keep latest callback without retriggering polling loop (React 19 — refs cannot be assigned during render).
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      if (pauseOnHidden && typeof document !== "undefined" && document.hidden) {
        timeoutId = setTimeout(tick, intervalMs);
        return;
      }
      try {
        await fnRef.current();
      } catch {
        // swallow — caller deve lidar com erros via state próprio
      }
      if (cancelled) return;
      timeoutId = setTimeout(tick, intervalMs);
    };

    if (skipInitial) {
      timeoutId = setTimeout(tick, intervalMs);
    } else {
      void tick();
    }

    const onVisibility = (): void => {
      if (!document.hidden && timeoutId) {
        clearTimeout(timeoutId);
        void tick();
      }
    };

    if (pauseOnHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (pauseOnHidden && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs, pauseOnHidden, skipInitial]);
}
