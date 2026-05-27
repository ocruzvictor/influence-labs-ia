/**
 * ClientSidebar — sidebar direita (desktop) ou conteúdo de Sheet (mobile)
 * com dados do cliente + ações stub disabled (vão ser ativadas na Story 1.4).
 *
 * Trinks fields (cadastro, última visita, visitas totais) são OUT desta story.
 * O comentário JSX TODO no corpo do componente marca o ponto de extensão futura
 * (Story 1.5-DATA: Trinks integration).
 */

"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPhone } from "@/lib/format/phone";
import { formatAbsolute } from "@/lib/format/date";
import type { ClientRow } from "@/lib/clients";

interface Props {
  phone: string;
  client: ClientRow | null;
  msgCount: number | null;
  firstMsgAt: string | null;
}

export function ClientSidebar({ phone, client, msgCount, firstMsgAt }: Props): React.ReactElement {
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
          <StubButton label="Pausar bot 1h" />
          <StubButton label="Bloquear número" />
          <StubButton label="Adicionar nota" />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Disponível em breve.
        </p>
      </section>
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

function StubButton({ label }: { label: string }): React.ReactElement {
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
      <TooltipContent side="left">Disponível na Story 1.4</TooltipContent>
    </Tooltip>
  );
}
