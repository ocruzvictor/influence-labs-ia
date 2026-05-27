/**
 * ModeBadge — badge colorido por modo da whitelist (AC16).
 *
 *   allow      → 🟢 Permitido (verde floresta)
 *   block      → 🚫 Bloqueado (vermelho discreto)
 *   human_only → 👤 Humano (terracotta)
 */

import { Badge } from "@/components/ui/badge";
import type { WhitelistMode } from "@/lib/hooks/use-whitelist";

interface Props {
  mode: WhitelistMode;
}

const META: Record<WhitelistMode, { label: string; emoji: string; classes: string; aria: string }> = {
  allow: {
    label: "Permitido",
    emoji: "🟢",
    classes: "border-[#2D6A4F]/40 bg-[#2D6A4F]/10 text-[#2D6A4F]",
    aria: "Modo permitido — bot responde normalmente",
  },
  block: {
    label: "Bloqueado",
    emoji: "🚫",
    classes: "border-red-500/40 bg-red-500/10 text-red-700",
    aria: "Modo bloqueado — bot ignora mensagens deste número",
  },
  human_only: {
    label: "Humano",
    emoji: "👤",
    classes: "border-[#D4622B]/40 bg-[#D4622B]/10 text-[#D4622B]",
    aria: "Modo humano — atendimento humano apenas, bot fica em silêncio",
  },
};

export function ModeBadge({ mode }: Props): React.ReactElement {
  const meta = META[mode];
  return (
    <Badge variant="outline" className={meta.classes} aria-label={meta.aria}>
      {meta.emoji} {meta.label}
    </Badge>
  );
}
