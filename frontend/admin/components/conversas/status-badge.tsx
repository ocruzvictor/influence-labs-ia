/**
 * StatusBadge — derivado de `is_active_4h` + `had_takeover`.
 *
 * Regra (story AC12):
 *   • is_active_4h=true + had_takeover=false → 🟢 ativa
 *   • is_active_4h=true + had_takeover=true  → 👤 takeover
 *   • is_active_4h=false                     → ⚪ idle
 */

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  isActive: boolean;
  hadTakeover: boolean;
}

export function StatusBadge({ isActive, hadTakeover }: StatusBadgeProps): React.ReactElement {
  if (isActive && hadTakeover) {
    return (
      <Badge
        variant="outline"
        className="border-[#D4622B]/40 bg-[#D4622B]/10 text-[#D4622B]"
        aria-label="Conversa com takeover humano"
      >
        👤 takeover
      </Badge>
    );
  }
  if (isActive) {
    return (
      <Badge
        variant="outline"
        className="border-[#2D6A4F]/40 bg-[#2D6A4F]/10 text-[#2D6A4F]"
        aria-label="Conversa ativa nas últimas 4 horas"
      >
        🟢 ativa
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-zinc-300 bg-zinc-50 text-zinc-600"
      aria-label="Conversa inativa há mais de 4 horas"
    >
      ⚪ idle
    </Badge>
  );
}
