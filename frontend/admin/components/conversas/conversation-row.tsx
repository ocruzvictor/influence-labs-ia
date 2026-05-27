/**
 * ConversationRow — single row da tabela de conversas.
 *
 * Memoizada via `React.memo` (shallow prop equality). O parent `ConversationList`
 * cria novos objetos `summary` a cada fetch — então o memo só evita re-render
 * quando o React identifica que `summary`, `clientName` e `preservedQuery` são
 * a mesma referência do paint anterior (caso do polling no-op, onde `setItems`
 * com mesma lista é debatível mas ocorre raramente). Em fetchs reais com dados
 * novos a row re-renderiza — o que é o comportamento esperado.
 */

"use client";

import { memo } from "react";
import Link from "next/link";
import type { ConversationSummary } from "@/lib/conversas";
import { formatPhone } from "@/lib/format/phone";
import { formatRelative, formatAbsolute } from "@/lib/format/date";
import { StatusBadge } from "./status-badge";

interface Props {
  summary: ConversationSummary;
  clientName: string | null;
  /** Querystring atual da página, pra preservar filtros no link. */
  preservedQuery: string;
}

function ConversationRowImpl({ summary, clientName, preservedQuery }: Props): React.ReactElement {
  const href = `/conversas/${summary.client_phone}${preservedQuery ? `?from=${encodeURIComponent(preservedQuery)}` : ""}`;

  return (
    <Link
      href={href}
      className="grid grid-cols-[1.4fr_1.2fr_0.6fr_1.2fr_0.8fr_1fr] items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm transition hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA]/30 sm:gap-3"
      tabIndex={0}
    >
      <span className="truncate font-mono text-xs text-[#1A1A2E] sm:text-sm">
        {formatPhone(summary.client_phone)}
      </span>
      <span className="truncate text-zinc-700">{clientName ?? "—"}</span>
      <span className="text-right tabular-nums text-zinc-600">{summary.msg_count}</span>
      <span
        className="truncate text-zinc-600"
        title={formatAbsolute(summary.last_msg_at)}
      >
        {formatRelative(summary.last_msg_at)}
      </span>
      <span className="truncate font-mono text-xs text-zinc-500">
        {summary.last_agent ?? "—"}
      </span>
      <span className="flex justify-end">
        <StatusBadge isActive={summary.is_active_4h} hadTakeover={summary.had_takeover} />
      </span>
    </Link>
  );
}

export const ConversationRow = memo(ConversationRowImpl);
