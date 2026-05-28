/**
 * CategoryCard — agrupador visual de uma categoria.
 *
 * Story: 1.5 (AC3, AC6-7)
 */

"use client";

import type { KbItem, KbCategory } from "@/lib/kb-types";
import { Badge } from "@/components/ui/badge";
import { KbRow } from "./kb-row";

const CATEGORY_META: Record<KbCategory, { label: string; color: string }> = {
  faq: { label: "FAQ", color: "bg-blue-100 text-blue-800" },
  servicos: { label: "Serviços", color: "bg-emerald-100 text-emerald-800" },
  regras: { label: "Regras", color: "bg-amber-100 text-amber-800" },
  padroes: { label: "Padrões de fala", color: "bg-violet-100 text-violet-800" },
  info: { label: "Info estática", color: "bg-zinc-100 text-zinc-800" },
};

interface Props {
  category: KbCategory;
  items: KbItem[];
  onEdit: (item: KbItem) => void;
  onHistory: (item: KbItem) => void;
  onToggleActive: (item: KbItem, active: boolean) => void;
  onDelete: (item: KbItem) => void;
  mutating: boolean;
  kbConfigured: boolean;
}

export function CategoryCard({
  category,
  items,
  onEdit,
  onHistory,
  onToggleActive,
  onDelete,
  mutating,
  kbConfigured,
}: Props): React.ReactElement {
  const meta = CATEGORY_META[category];

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <Badge className={meta.color}>{meta.label}</Badge>
          <span className="text-xs text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
      </header>
      <div className="divide-y divide-zinc-100">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Nenhum item em {meta.label.toLowerCase()} ainda.
          </p>
        ) : (
          items.map((item) => (
            <KbRow
              key={item.id}
              item={item}
              onEdit={onEdit}
              onHistory={onHistory}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              mutating={mutating}
              kbConfigured={kbConfigured}
            />
          ))
        )}
      </div>
    </section>
  );
}
