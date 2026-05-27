/**
 * KillSwitchCard — toggle global do bot.
 *
 * Confirmação obrigatória via AlertDialog (AC5). Diferente de features que
 * mudam sem confirmação, o kill switch tem alto impacto operacional
 * (silencia o bot inteiro pra todos os clientes).
 *
 * autoFocus em Cancelar dentro do AlertDialog (AC34 — defesa contra
 * click acidental).
 */

"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
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
import { useToggleMutation } from "@/lib/hooks/use-toggle-mutation";
import { formatRelative } from "@/lib/format/date";
import { getToggleMeta } from "@/lib/toggles-meta";

interface Props {
  toggle: {
    key: string;
    enabled: boolean;
    description: string | null;
    updated_at: string;
  };
  lastEditorEmail: string | null;
  onMutated: () => void | Promise<void>;
}

export function KillSwitchCard({ toggle, lastEditorEmail, onMutated }: Props): React.ReactElement {
  const meta = getToggleMeta(toggle.key);
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null);
  const { mutate, pending } = useToggleMutation({ onSuccess: onMutated });

  const isOpen = pendingTarget !== null;
  const requestToggle = (next: boolean): void => setPendingTarget(next);
  const cancel = (): void => setPendingTarget(null);
  const confirm = async (): Promise<void> => {
    if (pendingTarget === null) return;
    const target = pendingTarget;
    setPendingTarget(null);
    await mutate(toggle.key, target);
  };

  return (
    <section className="rounded-md border-2 border-[#1A1A2E]/15 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        Kill switch global
      </h2>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-base font-medium text-[#1A1A2E]">{meta.label}</p>
          <p className="mt-1 text-sm text-zinc-600">{meta.description}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Última alteração: <strong>{lastEditorEmail ?? "sistema"}</strong>,{" "}
            {formatRelative(toggle.updated_at)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Switch
            checked={toggle.enabled}
            onCheckedChange={requestToggle}
            disabled={pending}
            aria-label={toggle.enabled ? "Desativar bot" : "Ativar bot"}
          />
          <span className={`text-xs font-medium ${toggle.enabled ? "text-[#2D6A4F]" : "text-zinc-500"}`}>
            {toggle.enabled ? "ATIVO" : "DESLIGADO"}
          </span>
        </div>
      </div>

      <AlertDialog open={isOpen} onOpenChange={(open) => !open && cancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTarget === false
                ? "Desligar bot?"
                : "Religar bot?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTarget === false
                ? "Bot ficará 100% offline até religar. Mensagens recebidas no WhatsApp não receberão resposta automática. Propaga em até 5 segundos."
                : "Bot voltará a responder automaticamente todas as mensagens permitidas pela whitelist. Propaga em até 5 segundos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
