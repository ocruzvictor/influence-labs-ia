/**
 * ToggleRow — single switch + label + descrição. Usado dentro de FeaturesCard.
 *
 * Sem confirmação (AC13) — toast pós-ação cobre feedback.
 * Optimistic update local: switch vira imediatamente; em erro, useToggleMutation
 * mostra toast e o re-fetch externo corrige o estado.
 */

"use client";

import { Switch } from "@/components/ui/switch";
import { useToggleMutation } from "@/lib/hooks/use-toggle-mutation";
import { getToggleMeta } from "@/lib/toggles-meta";

interface Props {
  toggle: {
    key: string;
    enabled: boolean;
  };
  onMutated: () => void | Promise<void>;
}

export function ToggleRow({ toggle, onMutated }: Props): React.ReactElement {
  const meta = getToggleMeta(toggle.key);
  const { mutate, pending } = useToggleMutation({ onSuccess: onMutated });

  return (
    <div className="flex items-start justify-between gap-4 border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#1A1A2E]">{meta.label}</p>
        {meta.description ? (
          <p className="mt-0.5 text-xs text-zinc-600">{meta.description}</p>
        ) : null}
      </div>
      <Switch
        checked={toggle.enabled}
        onCheckedChange={(next) => void mutate(toggle.key, next)}
        disabled={pending}
        aria-label={`Toggle ${meta.label}`}
      />
    </div>
  );
}
