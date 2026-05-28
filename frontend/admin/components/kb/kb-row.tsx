/**
 * KbRow — single row de item com toggle active + menu (edit/history/delete).
 *
 * Story: 1.5 (AC4-5, AC23-26, AC33)
 */

"use client";

import { useState } from "react";
import type { KbItem } from "@/lib/kb-types";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatRelative } from "@/lib/format/date";

interface Props {
  item: KbItem;
  onEdit: (item: KbItem) => void;
  onHistory: (item: KbItem) => void;
  onToggleActive: (item: KbItem, active: boolean) => void;
  onDelete: (item: KbItem) => void;
  mutating: boolean;
  kbConfigured: boolean;
}

export function KbRow({
  item,
  onEdit,
  onHistory,
  onToggleActive,
  onDelete,
  mutating,
  kbConfigured,
}: Props): React.ReactElement {
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isDesynced = item.tess_sync_failed_at !== null;
  const preview =
    item.content_md
      .split("\n")
      .find((l) => l.trim() && !l.startsWith("#"))
      ?.slice(0, 100) ?? "";

  function handleToggleClick(next: boolean) {
    if (item.active && !next) {
      setDeactivateConfirmOpen(true);
    } else {
      onToggleActive(item, next);
    }
  }

  function confirmDeactivate() {
    setDeactivateConfirmOpen(false);
    onToggleActive(item, false);
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    onDelete(item);
  }

  return (
    <div className={`flex items-start gap-4 px-5 py-4 ${item.active ? "" : "opacity-60"}`}>
      <Switch
        checked={item.active}
        onCheckedChange={handleToggleClick}
        disabled={mutating || !kbConfigured}
        aria-label={`Ativar ou desativar ${item.title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-[#1A1A2E]">{item.title}</h3>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">v{item.version}</span>
          {!item.active && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700">
              Desativado
            </span>
          )}
          {isDesynced && (
            <span
              className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-rose-800"
              title={item.tess_sync_error ?? "Falha ao sincronizar com TESS"}
            >
              Dessincronizado
            </span>
          )}
        </div>
        {preview && <p className="mt-1 line-clamp-1 text-sm text-zinc-600">{preview}</p>}
        <p className="mt-1 text-xs text-zinc-500">
          Última edição por <span className="font-mono">{item.updated_by_email ?? "sistema"}</span>{" "}
          • {formatRelative(item.updated_at)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(item)}
          disabled={mutating || !kbConfigured}
        >
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={mutating}>
              ⋯
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onHistory(item)}>Histórico</DropdownMenuItem>
            <DropdownMenuItem
              className="text-rose-700 focus:bg-rose-50 focus:text-rose-800"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={!kbConfigured}
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation: desativar */}
      <AlertDialog open={deactivateConfirmOpen} onOpenChange={setDeactivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar &quot;{item.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Desativar removerá este item das próximas conversas do agente. Você pode reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: excluir */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{item.title}&quot; permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Histórico será preservado mas o item sumirá da lista e do agente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
