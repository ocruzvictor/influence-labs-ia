/**
 * KbEditorDialog — Dialog que cria OU edita item de KB.
 *
 * Markdown editor: @uiw/react-md-editor (carregado via dynamic, ssr: false)
 *
 * Story: 1.5 (AC10-22)
 *
 * Arquitetura: outer (Dialog shell) + inner (EditorForm) keyed por item.id || "new" || open.
 * Inner remonta quando muda → state inicial limpo sem effect cascading.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { KbItem, KbCategory } from "@/lib/kb-types";
import { KB_CATEGORIES, slugify } from "@/lib/kb-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
      Carregando editor…
    </div>
  ),
});

const MAX_CHARS = 32_000;
const WARN_CHARS = 31_500;

interface SubmitPayload {
  slug: string;
  category: KbCategory;
  title: string;
  content_md: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: KbItem | null;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  mutating: boolean;
}

export function KbEditorDialog({ open, onOpenChange, item, onSubmit, mutating }: Props): React.ReactElement {
  const formKey = item ? `edit:${item.id}` : `new:${open ? "open" : "closed"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {open && (
          <EditorForm
            key={formKey}
            item={item}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            mutating={mutating}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  item: KbItem | null;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCancel: () => void;
  mutating: boolean;
}

function EditorForm({ item, onSubmit, onCancel, mutating }: FormProps): React.ReactElement {
  const editMode = item !== null;
  const [title, setTitle] = useState<string>(item?.title ?? "");
  const [slug, setSlug] = useState<string>(item?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<KbCategory>(item?.category ?? "faq");
  const [contentMd, setContentMd] = useState<string>(item?.content_md ?? "");

  function handleTitleChange(next: string) {
    setTitle(next);
    if (!editMode && !slugTouched) {
      setSlug(slugify(next));
    }
  }

  const charCount = contentMd.length;
  const slugValid = /^[a-z0-9-]+$/.test(slug);
  const submittable =
    !mutating && title.trim().length > 0 && slugValid && contentMd.trim().length > 0 && charCount <= MAX_CHARS;

  async function handleSubmit() {
    if (!submittable) return;
    await onSubmit({
      slug: slug.trim(),
      category,
      title: title.trim(),
      content_md: contentMd,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editMode ? `Editar: ${item?.title}` : "Novo item de KB"}</DialogTitle>
        <DialogDescription>
          {editMode
            ? `Versão atual: v${item?.version}. Salvar criará v${(item?.version ?? 0) + 1}.`
            : "Será criado como v1 e disponibilizado ao agente imediatamente."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="kb-title">Título</Label>
          <Input
            id="kb-title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            maxLength={200}
            disabled={mutating}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="kb-slug">Slug</Label>
            <Input
              id="kb-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugTouched(true);
              }}
              disabled={editMode || mutating}
              aria-invalid={!slugValid && slug.length > 0}
              placeholder="faq-promo-junho"
            />
            {!slugValid && slug.length > 0 && (
              <p className="mt-1 text-xs text-rose-700">Apenas letras minúsculas, números e &quot;-&quot;</p>
            )}
            {editMode && (
              <p className="mt-1 text-xs text-zinc-500">
                Slug não pode mudar após criação. Crie novo + desative o antigo se precisar trocar.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="kb-category">Categoria</Label>
            <select
              id="kb-category"
              aria-label="Categoria do item"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as KbCategory)}
              disabled={editMode || mutating}
            >
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div data-color-mode="light">
          <Label>Conteúdo (Markdown)</Label>
          <div className="mt-1 overflow-hidden rounded border border-zinc-300">
            <MDEditor
              value={contentMd}
              onChange={(v) => setContentMd(v ?? "")}
              height={400}
              preview="live"
              visibleDragbar={false}
            />
          </div>
          <p
            className={`mt-1 text-xs ${
              charCount > WARN_CHARS ? "text-rose-700" : "text-zinc-500"
            }`}
          >
            {charCount.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")} caracteres
            {charCount > WARN_CHARS && " — próximo do limite TESS"}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={mutating}>
          Cancelar
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={!submittable}
          className="bg-[#1A1A2E] text-white hover:bg-[#2A2A4E]"
        >
          {mutating ? "Salvando…" : editMode ? "Salvar" : "Criar item"}
        </Button>
      </DialogFooter>
    </>
  );
}
