/**
 * WhitelistRow — single row + AlertDialog de remove (ação destrutiva, AC20).
 */

"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
import { ModeBadge } from "./mode-badge";
import type { WhitelistItem } from "@/lib/hooks/use-whitelist";
import { formatPhone } from "@/lib/format/phone";
import { formatRelative, formatAbsolute } from "@/lib/format/date";

interface Props {
  item: WhitelistItem;
  onRemove: (phone: string) => Promise<boolean>;
  pendingRemove: boolean;
}

export function WhitelistRow({ item, onRemove, pendingRemove }: Props): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    // Fecha o dialog APENAS após sucesso. Em erro, dialog continua aberto
    // pra user ver o toast e decidir (cancelar ou tentar novamente).
    const ok = await onRemove(item.phone);
    if (ok) setConfirmOpen(false);
  };

  return (
    <div className="group grid grid-cols-[1.4fr_1fr_1.5fr_1.2fr_auto] items-center gap-2 border-b border-zinc-100 px-3 py-2.5 text-sm last:border-b-0 hover:bg-zinc-50 sm:gap-3">
      <span className="truncate font-mono text-xs text-[#1A1A2E] sm:text-sm">
        {formatPhone(item.phone)}
      </span>
      <span><ModeBadge mode={item.mode} /></span>
      <span className="truncate text-zinc-600" title={item.reason ?? ""}>
        {item.reason ?? <em className="text-zinc-400">sem motivo</em>}
      </span>
      <span className="truncate text-xs text-zinc-500">
        <span className="block truncate" title={item.added_by_email ?? "sistema"}>
          {item.added_by_email ?? "sistema"}
        </span>
        <span className="text-zinc-400" title={formatAbsolute(item.added_at)}>
          {formatRelative(item.added_at)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pendingRemove}
        aria-label={`Remover ${formatPhone(item.phone)} da whitelist`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
      >
        <X className="h-4 w-4" />
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover número da whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{formatPhone(item.phone)}</span> volta ao
              comportamento padrão do bot. Esta ação não pode ser desfeita pelo painel
              (mas você pode adicioná-lo de novo).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
