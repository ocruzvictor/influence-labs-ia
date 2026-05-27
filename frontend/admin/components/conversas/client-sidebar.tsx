/**
 * ClientSidebar — sidebar direita (desktop) ou conteúdo de Sheet (mobile)
 * com dados do cliente + ações rápidas.
 *
 * Ações (Story 1.4 ACs 29-30):
 *   • Pausar bot 1h        → POST /api/whitelist mode=human_only (sem expiração real;
 *                            schema não tem expires_at, Tiago remove manualmente)
 *   • Bloquear número      → AlertDialog → POST /api/whitelist mode=block
 *   • Adicionar nota       → permanece DISABLED (schema `notes` não existe; Story futura)
 *
 * Trinks fields (cadastro, última visita, visitas totais) são OUT.
 * O comentário JSX TODO marca extensão futura (Story 1.5-DATA Trinks).
 */

"use client";

import { useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPhone } from "@/lib/format/phone";
import { formatAbsolute } from "@/lib/format/date";
import { useWhitelist } from "@/lib/hooks/use-whitelist";
import type { ClientRow } from "@/lib/clients";

interface Props {
  phone: string;
  client: ClientRow | null;
  msgCount: number | null;
  firstMsgAt: string | null;
}

export function ClientSidebar({ phone, client, msgCount, firstMsgAt }: Props): React.ReactElement {
  // autoFetch=false: não precisamos da lista aqui, só o add() pra atalhos
  const { add, mutating } = useWhitelist(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const handlePause = async (): Promise<void> => {
    await add({
      phone,
      mode: "human_only",
      reason: "Pausado via drill-down (atendimento humano)",
    });
  };

  const handleBlockConfirm = async (): Promise<void> => {
    // Fecha o dialog APENAS após sucesso. Em erro, mantém aberto pra user
    // ver o toast e decidir (cancelar ou tentar novamente).
    const ok = await add({
      phone,
      mode: "block",
      reason: "Bloqueado via drill-down",
    });
    if (ok) setConfirmBlock(false);
  };

  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Dados do cliente
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Nome" value={client?.name ?? "—"} />
          <Row label="Telefone" value={formatPhone(phone)} mono />
          <Row
            label="Total de mensagens"
            value={msgCount === null ? "—" : msgCount.toLocaleString("pt-BR")}
          />
          <Row label="Primeira mensagem" value={formatAbsolute(firstMsgAt)} />
          {/* TODO Story 1.5-DATA: Trinks integration — cadastro, última visita, visit_count */}
        </dl>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Ações
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          <ActionButton
            label="Pausar bot nesta conversa"
            description="Bot vira `human_only` para este número"
            onClick={() => void handlePause()}
            disabled={mutating}
          />
          <ActionButton
            label="Bloquear número"
            description="Bot ignora completamente mensagens deste número"
            onClick={() => setConfirmBlock(true)}
            disabled={mutating}
            variant="destructive"
          />
          <DisabledStubButton label="Adicionar nota" />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Ações usam a whitelist global. Você pode editar/remover em <strong>/toggles</strong>.
        </p>
      </section>

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear este número?</AlertDialogTitle>
            <AlertDialogDescription>
              Bot vai ignorar completamente <span className="font-mono">{formatPhone(phone)}</span>.
              Você pode reverter removendo o número da whitelist em <strong>/toggles</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBlockConfirm()}>
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={mono ? "font-mono text-sm text-[#1A1A2E]" : "text-sm text-[#1A1A2E]"}>{value}</dd>
    </div>
  );
}

function ActionButton({
  label,
  description,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const classes =
    variant === "destructive"
      ? "border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:hover:bg-white"
      : "border-zinc-200 bg-white text-[#1A1A2E] hover:bg-zinc-50 disabled:hover:bg-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={description}
      className={`rounded-md border px-3 py-1.5 text-left text-sm transition disabled:opacity-50 ${classes}`}
    >
      {label}
    </button>
  );
}

function DisabledStubButton({ label }: { label: string }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled
          className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-sm text-zinc-400"
          aria-disabled="true"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Disponível em breve (depende de schema notes)</TooltipContent>
    </Tooltip>
  );
}
