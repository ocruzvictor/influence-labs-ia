/**
 * useKb — orquestra CRUD em /api/kb (list/create/update/active/delete/restore).
 *
 * Estado interno:
 *   • items: KbItem[]
 *   • loading: bool
 *   • mutating: bool
 *
 * Story: 1.5 (KB editor)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { KbItem, KbVersion, KbCategory } from "@/lib/kb-types";

interface ListResponse {
  items: KbItem[];
}
interface SingleResponse {
  item: KbItem;
}
interface VersionsResponse {
  item: KbItem;
  versions: KbVersion[];
}

function isListResponse(value: unknown): value is ListResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { items?: unknown }).items);
}
function isSingleResponse(value: unknown): value is SingleResponse {
  if (!value || typeof value !== "object") return false;
  return Boolean((value as { item?: unknown }).item);
}
function isVersionsResponse(value: unknown): value is VersionsResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as { item?: unknown; versions?: unknown };
  return Boolean(v.item) && Array.isArray(v.versions);
}

export interface CreateKbInput {
  slug: string;
  category: KbCategory;
  title: string;
  content_md: string;
}

export interface UpdateKbInput {
  title: string;
  content_md: string;
}

interface UseKbResult {
  items: KbItem[];
  loading: boolean;
  mutating: boolean;
  refetch: () => Promise<void>;
  create: (input: CreateKbInput) => Promise<KbItem | null>;
  update: (id: string, input: UpdateKbInput) => Promise<KbItem | null>;
  setActive: (id: string, active: boolean) => Promise<KbItem | null>;
  remove: (id: string) => Promise<boolean>;
  fetchVersions: (id: string) => Promise<{ item: KbItem; versions: KbVersion[] } | null>;
  restore: (id: string, version: number) => Promise<KbItem | null>;
}

export function useKb(initialItems: KbItem[] = [], autoFetch = false): UseKbResult {
  const [items, setItems] = useState<KbItem[]>(initialItems);
  const [loading, setLoading] = useState(autoFetch);
  const [mutating, setMutating] = useState(false);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/kb", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      if (!isListResponse(raw)) throw new Error("invalid_response_shape");
      setItems(raw.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error";
      toast.error("Falha ao carregar KB", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const id = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(id);
  }, [autoFetch, refetch]);

  const parseErrorMessage = async (res: Response): Promise<string> => {
    try {
      const raw: unknown = await res.json();
      if (raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string") {
        if ("detail" in raw && typeof raw.detail === "string") return raw.detail;
        return raw.error;
      }
    } catch {}
    return `HTTP ${res.status}`;
  };

  const create = useCallback(
    async (input: CreateKbInput): Promise<KbItem | null> => {
      setMutating(true);
      try {
        const res = await fetch("/api/kb", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        const raw: unknown = await res.json();
        if (!isSingleResponse(raw)) throw new Error("invalid_response_shape");
        toast.success("Item criado. Refletindo em ~5s no agente.");
        await refetch();
        return raw.item;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao criar item", { description: msg });
        return null;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, input: UpdateKbInput): Promise<KbItem | null> => {
      setMutating(true);
      try {
        const res = await fetch(`/api/kb/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok && res.status !== 502) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        const raw: unknown = await res.json();
        if (!isSingleResponse(raw)) throw new Error("invalid_response_shape");
        if (res.status === 502) {
          toast.warning("Item salvo no painel, mas falha de sync TESS", {
            description: "Tentaremos sincronizar novamente.",
          });
        } else if ((raw as { unchanged?: boolean }).unchanged) {
          toast.info("Nenhuma mudança detectada");
        } else {
          toast.success(`Atualizado para v${raw.item.version}`);
        }
        await refetch();
        return raw.item;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao atualizar item", { description: msg });
        return null;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  const setActive = useCallback(
    async (id: string, active: boolean): Promise<KbItem | null> => {
      setMutating(true);
      try {
        const res = await fetch(`/api/kb/${encodeURIComponent(id)}/active`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (!res.ok) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        const raw: unknown = await res.json();
        if (!isSingleResponse(raw)) throw new Error("invalid_response_shape");
        toast.success(active ? "Item reativado no agente." : "Item desativado. Agente não verá mais.");
        await refetch();
        return raw.item;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao alterar status", { description: msg });
        return null;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setMutating(true);
      try {
        const res = await fetch(`/api/kb/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok && res.status !== 204) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        toast.success("Item removido");
        await refetch();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao remover", { description: msg });
        return false;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  const fetchVersions = useCallback(
    async (id: string): Promise<{ item: KbItem; versions: KbVersion[] } | null> => {
      try {
        const res = await fetch(`/api/kb/${encodeURIComponent(id)}/versions`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        const raw: unknown = await res.json();
        if (!isVersionsResponse(raw)) throw new Error("invalid_response_shape");
        return { item: raw.item, versions: raw.versions };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao carregar histórico", { description: msg });
        return null;
      }
    },
    [],
  );

  const restore = useCallback(
    async (id: string, version: number): Promise<KbItem | null> => {
      setMutating(true);
      try {
        const res = await fetch(`/api/kb/${encodeURIComponent(id)}/restore/${version}`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok && res.status !== 502) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
        const raw: unknown = await res.json();
        if (!isSingleResponse(raw)) throw new Error("invalid_response_shape");
        if (res.status === 502) {
          toast.warning("Restore aplicado mas sync TESS falhou");
        } else {
          toast.success(`Restaurado em v${raw.item.version}`);
        }
        await refetch();
        return raw.item;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network_error";
        toast.error("Falha ao restaurar versão", { description: msg });
        return null;
      } finally {
        setMutating(false);
      }
    },
    [refetch],
  );

  return { items, loading, mutating, refetch, create, update, setActive, remove, fetchVersions, restore };
}
