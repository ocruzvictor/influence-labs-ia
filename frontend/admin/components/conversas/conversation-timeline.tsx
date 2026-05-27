/**
 * ConversationTimeline — drill-down de uma conversa.
 *
 * Comportamento:
 *   • Fetch inicial via GET /api/conversas/[phone]?limit=50 → mensagens DESC
 *   • UI inverte para ASC (mais antiga em cima, mais recente embaixo)
 *   • Polling 3s — busca mensagens recentes; merge sem duplicar (por id)
 *   • Autoscroll inteligente: scrolla pro fim apenas se user está perto do fim;
 *     senão, badge "↓ Nova mensagem" sticky aparece
 *   • Botão "Carregar mais antigas" — preserva scroll position via useScrollPreserve
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationMessage } from "@/lib/conversas";
import { usePolling } from "@/lib/hooks/use-polling";
import { useScrollPreserve } from "@/lib/hooks/use-scroll-preserve";
import { MessageBubble } from "./message-bubble";

const TIMELINE_POLL_MS = 3_000;
const TIMELINE_PAGE_SIZE = 50;
const BOTTOM_THRESHOLD_PX = 100;

interface TimelineResponse {
  phone: string;
  messages: ConversationMessage[];
  has_more: boolean;
  next_before: string | null;
}

interface Props {
  phone: string;
}

export function ConversationTimeline({ phone }: Props): React.ReactElement {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const { capture } = useScrollPreserve(containerRef);
  const fetchSeq = useRef(0);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto"): void => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  const isNearBottom = (el: HTMLElement): boolean =>
    el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;

  const handleScroll = useCallback((): void => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = isNearBottom(el);
    if (isAtBottomRef.current) setHasNewBelow(false);
  }, []);

  // ─── Fetch principal (recent + merge sem duplicar) ─────────────────────
  const fetchRecent = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeq.current;
    try {
      const res = await fetch(`/api/conversas/${phone}?limit=${TIMELINE_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TimelineResponse;
      if (seq !== fetchSeq.current) return;

      // API retorna DESC; invertemos pra ASC (mais antiga primeiro)
      const fresh = [...data.messages].reverse();
      setMessages((prev) => mergeMessages(prev, fresh));
      setHasOlder(data.has_more);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      const msg = err instanceof Error ? err.message : "network_error";
      toast.error("Falha ao carregar timeline", { description: msg });
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [phone]);

  // ─── Initial load + autoscroll bottom ──────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => void fetchRecent(), 0);
    return () => clearTimeout(id);
  }, [fetchRecent]);

  // Quando lista de mensagens muda E user está no fim → autoscroll
  useEffect(() => {
    if (messages.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      // Defer pra próximo paint
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setHasNewBelow(true);
    }
  }, [messages, scrollToBottom]);

  // Polling
  usePolling(() => fetchRecent(), TIMELINE_POLL_MS);

  // ─── Carregar mais antigas ─────────────────────────────────────────────
  const loadOlder = useCallback(async (): Promise<void> => {
    if (loadingOlder || !hasOlder || messages.length === 0) return;
    setLoadingOlder(true);
    capture(); // snapshot scrollHeight ANTES do prepend
    try {
      const oldest = messages[0]!.created_at;
      const res = await fetch(
        `/api/conversas/${phone}?before=${encodeURIComponent(oldest)}&limit=${TIMELINE_PAGE_SIZE}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TimelineResponse;
      const olderAsc = [...data.messages].reverse();
      setMessages((prev) => [...olderAsc, ...prev]);
      setHasOlder(data.has_more);
    } catch {
      toast.error("Falha ao carregar mensagens anteriores");
    } finally {
      setLoadingOlder(false);
    }
  }, [capture, hasOlder, loadingOlder, messages, phone]);

  // ─── Render ────────────────────────────────────────────────────────────
  if (loading && messages.length === 0) {
    return <TimelineSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Sem mensagens para este número.
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
        aria-live="polite"
      >
        {hasOlder ? (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
            </button>
          </div>
        ) : null}

        <div className="space-y-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </div>

      {hasNewBelow ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="rounded-full bg-[#1A1A2E] px-3 py-1.5 text-xs text-white shadow-lg hover:bg-[#2a2a48]"
          >
            ↓ Nova mensagem
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function mergeMessages(
  prev: ConversationMessage[],
  fresh: ConversationMessage[],
): ConversationMessage[] {
  if (prev.length === 0) return fresh;
  const seen = new Set(prev.map((m) => m.id));
  const newOnes = fresh.filter((m) => !seen.has(m.id));
  if (newOnes.length === 0) return prev;
  // fresh já está em ASC (foi invertido em fetchRecent); prev também em ASC.
  // Detect overlap: se a primeira mensagem de fresh é mais nova que a última de prev,
  // anexar no fim. Senão, faz dedupe completo e ordena por id (id é serial).
  const all = [...prev, ...newOnes];
  all.sort((a, b) => a.id - b.id);
  return all;
}

function TimelineSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => {
        const right = i % 2 === 0;
        return (
          <div key={i} className={right ? "flex justify-end" : "flex justify-start"}>
            <Skeleton className={right ? "h-12 w-2/3 max-w-[60%]" : "h-10 w-1/2 max-w-[60%]"} />
          </div>
        );
      })}
    </div>
  );
}
