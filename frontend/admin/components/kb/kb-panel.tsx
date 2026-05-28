/**
 * KbPanel — orquestrador client da página /kb.
 *
 * Gerencia:
 *   • Estado de lista (via useKb)
 *   • Dialog editor (create/edit) state
 *   • Sheet de histórico state
 *
 * Story: 1.5 (KB editor)
 */

"use client";

import { useState } from "react";
import { useKb } from "@/lib/hooks/use-kb";
import type { KbItem, KbCategory } from "@/lib/kb-types";
import { KB_CATEGORIES } from "@/lib/kb-types";
import { CategoryCard } from "./category-card";
import { KbEditorDialog } from "./kb-editor-dialog";
import { KbHistorySheet } from "./kb-history-sheet";
import { Button } from "@/components/ui/button";

interface Props {
  initialItems: KbItem[];
  kbConfigured: boolean;
}

export function KbPanel({ initialItems, kbConfigured }: Props): React.ReactElement {
  const kb = useKb(initialItems, false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KbItem | null>(null);
  const [historyForItem, setHistoryForItem] = useState<KbItem | null>(null);

  const grouped: Record<KbCategory, KbItem[]> = {
    faq: [],
    servicos: [],
    regras: [],
    padroes: [],
    info: [],
  };
  for (const item of kb.items) grouped[item.category].push(item);

  function openCreate() {
    setEditingItem(null);
    setEditorOpen(true);
  }

  function openEdit(item: KbItem) {
    setEditingItem(item);
    setEditorOpen(true);
  }

  function openHistory(item: KbItem) {
    setHistoryForItem(item);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button
          onClick={openCreate}
          disabled={!kbConfigured || kb.mutating}
          className="bg-[#1A1A2E] text-white hover:bg-[#2A2A4E]"
        >
          + Novo item
        </Button>
      </div>

      <div className="space-y-4">
        {KB_CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat}
            category={cat}
            items={grouped[cat]}
            onEdit={openEdit}
            onHistory={openHistory}
            onToggleActive={(item, active) => kb.setActive(item.id, active)}
            onDelete={(item) => kb.remove(item.id)}
            mutating={kb.mutating}
            kbConfigured={kbConfigured}
          />
        ))}
      </div>

      <KbEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editingItem}
        onSubmit={async (payload) => {
          if (editingItem) {
            const updated = await kb.update(editingItem.id, {
              title: payload.title,
              content_md: payload.content_md,
            });
            if (updated) setEditorOpen(false);
          } else {
            const created = await kb.create({
              slug: payload.slug,
              category: payload.category,
              title: payload.title,
              content_md: payload.content_md,
            });
            if (created) setEditorOpen(false);
          }
        }}
        mutating={kb.mutating}
      />

      <KbHistorySheet
        open={historyForItem !== null}
        onOpenChange={(open) => !open && setHistoryForItem(null)}
        item={historyForItem}
        fetchVersions={kb.fetchVersions}
        onRestore={async (id, version) => {
          const restored = await kb.restore(id, version);
          if (restored) setHistoryForItem(null);
        }}
        mutating={kb.mutating}
      />
    </div>
  );
}
