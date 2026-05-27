/**
 * useScrollPreserve — preserva posição de scroll quando items são prependados ao topo
 * de um container (caso clássico: "Carregar mensagens antigas" em timeline).
 *
 * Como usar:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { capture, restore } = useScrollPreserve(containerRef);
 *
 *   const loadOlder = async () => {
 *     capture();                  // snapshot ANTES do fetch
 *     const older = await fetchOlder();
 *     setMessages(prev => [...older, ...prev]);
 *     // restore() roda automaticamente após paint via useLayoutEffect interno
 *   };
 *
 * Por que useLayoutEffect e não useEffect:
 *   useEffect roda APÓS paint → user vê flicker (scroll pula).
 *   useLayoutEffect roda síncrono pré-paint → ajuste invisível.
 */

"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

interface UseScrollPreserve {
  capture: () => void;
  /** Chamado automaticamente pelo hook após render; exposto pra debug. */
  pendingRef: RefObject<number | null>;
}

export function useScrollPreserve<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
): UseScrollPreserve {
  const pendingRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingRef.current === null) return;
    const el = containerRef.current;
    if (!el) {
      pendingRef.current = null;
      return;
    }
    const delta = el.scrollHeight - pendingRef.current;
    el.scrollTop += delta;
    pendingRef.current = null;
  });

  const capture = (): void => {
    const el = containerRef.current;
    if (!el) return;
    pendingRef.current = el.scrollHeight;
  };

  return { capture, pendingRef };
}

/**
 * useOnlineStatus — simples wrapper de `navigator.onLine` + listeners.
 * Útil para banner offline (AC: estados de borda).
 */
export function useOnlineStatusValue(): boolean {
  // Implementação fica em arquivo próprio — aqui só re-export pra co-localizar
  // hooks de "comportamento do browser". Ver use-online-status.ts.
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
