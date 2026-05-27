/**
 * useWhitelist — orquestra GET /api/whitelist + POST /api/whitelist + DELETE /api/whitelist/[phone].
 *
 * Estado interno:
 *   • items: WhitelistRow[]
 *   • loading: bool (initial + refetch)
 *   • mutating: bool (durante POST/DELETE)
 *   • error: string | null
 *
 * Compartilhado entre:
 *   • <WhitelistTable> (consome items + remove())
 *   • <WhitelistAddDialog> (consome add())
 *   • client-sidebar drill-down (consome quickAdd() pra atalhos AC29/30)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type WhitelistMode = "allow" | "block" | "human_only";

export interface WhitelistItem {
  phone: string;
  mode: WhitelistMode;
  reason: string | null;
  added_by_email: string | null;
  added_at: string;
}

interface ListResponse {
  items: WhitelistItem[];
}

interface SingleResponse {
  item: WhitelistItem;
}

function isListResponse(value: unknown): value is ListResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { items?: unknown }).items);
}

function isSingleResponse(value: unknown): value is SingleResponse {
  if (!value || typeof value !== "object") return false;
  const item = (value as { item?: unknown }).item;
  return Boolean(item && typeof item === "object");
}

interface UseWhitelistResult {
  items: WhitelistItem[];
  loading: boolean;
  mutating: boolean;
  refetch: () => Promise<void>;
  add: (input: { phone: string; mode: WhitelistMode; reason?: string | null }) => Promise<boolean>;
  remove: (phone: string) => Promise<boolean>;
}

export function useWhitelist(autoFetch = true): UseWhitelistResult {
  const [items, setItems] = useState<WhitelistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [mutating, setMutating] = useState(false);

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/whitelist", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      if (!isListResponse(raw)) throw new Error("invalid_response_shape");
      setItems(raw.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error";
      toast.error("Falha ao carregar whitelist", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const id = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(id);
  }, [autoFetch, refetch]);

  const add = useCallback(
    async (input: { phone: string; mode: WhitelistMode; reason?: string | null }): Promise<boolean> => {
      setMutating(true);
      try {
        const res = await fetch("/api/whitelist", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: input.phone,
            mode: input.mode,
            reason: input.reason ?? null,
          }),
        });
        if (!res.ok) {
          const raw: unknown = await res.json().catch(() => ({}));
          const errMsg =
            raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string"
              ? raw.error
              : `HTTP ${res.status}`;
          throw new Error(errMsg);
        }
        const isUpdate = res.status === 200;
        const raw: unknown = await res.json();
        if (!isSingleResponse(raw)) throw new Error("invalid_response_shape");
        toast.success(isUpdate ? "Número atualizado" : "Número adicionado");
        await refetch();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao salvar número", { description: msg });
        return false;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  const remove = useCallback(
    async (phone: string): Promise<boolean> => {
      setMutating(true);
      try {
        const res = await fetch(`/api/whitelist/${encodeURIComponent(phone)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`HTTP ${res.status}`);
        }
        toast.success("Número removido");
        await refetch();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao remover número", { description: msg });
        return false;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  return { items, loading, mutating, refetch, add, remove };
}
