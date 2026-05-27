/**
 * ConversationList — client component que orquestra:
 *   • State de filtros (controlled pelos ConversationFilters)
 *   • Sincronização com URL via useRouter/useSearchParams
 *   • Fetch GET /api/conversas com cursor pagination
 *   • Polling 5s (Page Visibility-aware)
 *   • Estados: loading / error / empty / data
 *   • Search debounced (300ms)
 *
 * Constantes de polling expostas no topo para teste/ajuste futuro.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ConversationSummary,
  type ConversationStatus,
  type ConversationTakeover,
} from "@/lib/conversas";
import { usePolling } from "@/lib/hooks/use-polling";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { ConversationFilters, type ConversationFiltersValue } from "./conversation-filters";
import { ConversationRow } from "./conversation-row";
import { EmptyState } from "./empty-state";

const LIST_POLL_MS = 5_000;
const SEARCH_DEBOUNCE_MS = 300;

interface ListResponse {
  items: ConversationSummary[];
  next_cursor: string | null;
}

interface Props {
  /** Nomes pré-carregados pela page Server Component (phone → name). */
  initialNamesByPhone: Record<string, string | null>;
}

export function ConversationList({ initialNamesByPhone }: Props): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Filtros (lidos da URL no primeiro render) ──────────────────────────
  const initialFilters: ConversationFiltersValue = useMemo(
    () => ({
      status: (searchParams.get("status") ?? "all") as ConversationStatus,
      takeover: (searchParams.get("takeover") ?? "all") as ConversationTakeover,
      search: searchParams.get("search") ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [filters, setFilters] = useState<ConversationFiltersValue>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // ─── State de dados ────────────────────────────────────────────────────
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchSeq = useRef(0);
  const online = useOnlineStatus();

  // ─── Debounce search ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.search]);

  // ─── Sincroniza filtros → URL (sem trigger fetch extra) ────────────────
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.status !== "all") sp.set("status", filters.status);
    if (filters.takeover !== "all") sp.set("takeover", filters.takeover);
    if (debouncedSearch) sp.set("search", debouncedSearch);
    const qs = sp.toString();
    const target = qs ? `/conversas?${qs}` : "/conversas";
    router.replace(target, { scroll: false });
  }, [filters.status, filters.takeover, debouncedSearch, router]);

  // ─── Fetch principal (substitui items) ─────────────────────────────────
  const fetchList = useCallback(
    async (opts: { showSpinner: boolean } = { showSpinner: false }): Promise<void> => {
      const seq = ++fetchSeq.current;
      if (opts.showSpinner) setRefreshing(true);
      try {
        const sp = new URLSearchParams();
        sp.set("status", filters.status);
        sp.set("takeover", filters.takeover);
        if (debouncedSearch) sp.set("search", debouncedSearch);
        const res = await fetch(`/api/conversas?${sp.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ListResponse;
        // Descarta resposta se outra requisição mais nova já completou
        if (seq !== fetchSeq.current) return;
        setItems(data.items);
        setNextCursor(data.next_cursor);
        setError(null);
      } catch (err) {
        if (seq !== fetchSeq.current) return;
        const msg = err instanceof Error ? err.message : "network_error";
        setError(msg);
        toast.error("Falha ao carregar conversas", {
          description: "Mantendo último estado válido. Tentando de novo no próximo ciclo.",
        });
      } finally {
        if (seq === fetchSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filters.status, filters.takeover, debouncedSearch],
  );

  // ─── Re-fetch quando filtros mudam ─────────────────────────────────────
  // Não dispara skeleton: mantém items anteriores até nova resposta chegar
  // (evita flicker). Skeleton só roda no primeiro mount via `loading=true` inicial.
  // Defer pra próximo tick — fetchList chama setState síncrono (setRefreshing) e
  // React 19 reclama de cascading renders quando isso roda no body do effect.
  useEffect(() => {
    const id = setTimeout(() => void fetchList({ showSpinner: false }), 0);
    return () => clearTimeout(id);
  }, [fetchList]);

  // ─── Polling automático ────────────────────────────────────────────────
  usePolling(() => fetchList(), LIST_POLL_MS);

  // ─── Carregar mais (próxima página por cursor) ─────────────────────────
  const loadMore = useCallback(async (): Promise<void> => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const sp = new URLSearchParams();
      sp.set("status", filters.status);
      sp.set("takeover", filters.takeover);
      if (debouncedSearch) sp.set("search", debouncedSearch);
      sp.set("cursor", nextCursor);
      const res = await fetch(`/api/conversas?${sp.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch {
      toast.error("Falha ao carregar próxima página");
    } finally {
      setLoadingMore(false);
    }
  }, [filters.status, filters.takeover, debouncedSearch, nextCursor, loadingMore]);

  // ─── Query atual pra preservar no link do drill-down ───────────────────
  const preservedQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.status !== "all") sp.set("status", filters.status);
    if (filters.takeover !== "all") sp.set("takeover", filters.takeover);
    if (debouncedSearch) sp.set("search", debouncedSearch);
    return sp.toString();
  }, [filters.status, filters.takeover, debouncedSearch]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ConversationFilters
        value={filters}
        onChange={setFilters}
        onRefresh={() => fetchList({ showSpinner: true })}
        loading={refreshing}
      />

      {!online ? (
        <div className="rounded-md border border-[#D4622B]/40 bg-[#D4622B]/10 px-3 py-2 text-sm text-[#D4622B]">
          Sem conexão. Tentando reconectar...
        </div>
      ) : null}

      <section
        aria-live="polite"
        aria-busy={loading}
        className="overflow-hidden rounded-md border border-zinc-200 bg-white"
      >
        <header className="grid grid-cols-[1.4fr_1.2fr_0.6fr_1.2fr_0.8fr_1fr] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500 sm:gap-3">
          <span>Telefone</span>
          <span>Nome</span>
          <span className="text-right">Msgs</span>
          <span>Última msg</span>
          <span>Agente</span>
          <span className="text-right">Status</span>
        </header>

        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 && !error ? (
          <EmptyState />
        ) : (
          items.map((it) => (
            <ConversationRow
              key={it.client_phone}
              summary={it}
              clientName={initialNamesByPhone[it.client_phone] ?? null}
              preservedQuery={preservedQuery}
            />
          ))
        )}
      </section>

      {nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1.4fr_1.2fr_0.6fr_1.2fr_0.8fr_1fr] items-center gap-2 px-3 py-2.5 sm:gap-3"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-8" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
