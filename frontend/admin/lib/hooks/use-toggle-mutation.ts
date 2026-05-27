/**
 * useToggleMutation — wrapper de PATCH /api/toggles com:
 *   • Optimistic update (UI vira imediatamente)
 *   • Revert em erro (UI volta + toast)
 *   • Re-fetch da lista pós-success pra refletir `updated_at`
 *
 * Uso:
 *   const { mutate, pending } = useToggleMutation({ onSuccess: refetch });
 *   await mutate("global", false);
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

interface ToggleResponse {
  toggle: {
    key: string;
    enabled: boolean;
    description: string | null;
    updated_at: string;
  };
}

function isToggleResponse(value: unknown): value is ToggleResponse {
  if (!value || typeof value !== "object") return false;
  const t = (value as { toggle?: unknown }).toggle;
  if (!t || typeof t !== "object") return false;
  const r = t as Record<string, unknown>;
  return typeof r.key === "string" && typeof r.enabled === "boolean";
}

interface UseToggleMutationOptions {
  /** Chamado após PATCH bem-sucedido — tipicamente para re-fetch da lista. */
  onSuccess?: () => void | Promise<void>;
  /** Chamado em erro, depois do toast. */
  onError?: (err: Error) => void;
}

export function useToggleMutation(options: UseToggleMutationOptions = {}): {
  mutate: (key: string, enabled: boolean) => Promise<boolean>;
  pending: boolean;
} {
  const [pending, setPending] = useState(false);

  const mutate = useCallback(
    async (key: string, enabled: boolean): Promise<boolean> => {
      setPending(true);
      try {
        const res = await fetch("/api/toggles", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, enabled }),
        });
        if (!res.ok) {
          const raw: unknown = await res.json().catch(() => ({}));
          const errMsg =
            raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string"
              ? raw.error
              : `HTTP ${res.status}`;
          throw new Error(errMsg);
        }
        const raw: unknown = await res.json();
        if (!isToggleResponse(raw)) {
          throw new Error("invalid_response_shape");
        }
        toast.success(enabled ? "Toggle ativado" : "Toggle desativado", {
          description: "Bot atualizado. Propaga em até 5s no fluxo de mensagens.",
        });
        await options.onSuccess?.();
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("unknown_error");
        toast.error("Falha ao alterar toggle", { description: error.message });
        options.onError?.(error);
        return false;
      } finally {
        setPending(false);
      }
    },
    [options],
  );

  return { mutate, pending };
}
