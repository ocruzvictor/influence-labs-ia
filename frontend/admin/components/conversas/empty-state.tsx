/**
 * EmptyState — exibido quando GET /api/conversas retorna items=[].
 * Conforme wireframe T3 §215.
 */

import { MessageSquareOff } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "Nada por aqui ainda.",
  description = "As conversas aparecem assim que o bot recebe uma mensagem.",
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <MessageSquareOff className="h-10 w-10 text-zinc-300" aria-hidden="true" />
      <p className="text-base font-medium text-[#1A1A2E]">{title}</p>
      <p className="max-w-md text-sm text-zinc-600">{description}</p>
    </div>
  );
}
