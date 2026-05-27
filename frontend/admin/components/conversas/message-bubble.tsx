/**
 * MessageBubble — render de uma mensagem da timeline.
 *
 * Bubble alignment por role:
 *   • user      → esquerda, fundo cinza neutro
 *   • assistant → direita, fundo navy 8% opacity
 *   • system    → centralizado, font pequena, color muted
 *
 * Metadata abaixo: agent · intent · trace_id (truncado, tooltip full) · created_at relativo.
 * `content` renderizado com `whitespace-pre-wrap` — nunca `dangerouslySetInnerHTML`.
 */

"use client";

import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConversationMessage } from "@/lib/conversas";
import { formatRelative, formatAbsolute } from "@/lib/format/date";

interface Props {
  message: ConversationMessage;
}

function MessageBubbleImpl({ message }: Props): React.ReactElement {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-md bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
          {message.content}
        </span>
      </div>
    );
  }

  const wrapperCls = isAssistant ? "flex justify-end" : "flex justify-start";
  const bubbleCls = isAssistant
    ? "max-w-[80%] rounded-lg bg-[#1A1A2E]/8 px-3 py-2 text-sm text-[#1A1A2E]"
    : "max-w-[80%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800";

  const traceShort = message.trace_id ? message.trace_id.slice(0, 8) : null;

  return (
    <div className={wrapperCls}>
      <div className="flex max-w-full flex-col gap-1">
        <div className={bubbleCls}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 ${
            isAssistant ? "justify-end" : "justify-start"
          }`}
        >
          {message.agent ? <span className="font-mono">{message.agent}</span> : null}
          {message.intent ? (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">{message.intent}</span>
          ) : null}
          {traceShort ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help font-mono text-zinc-400">{traceShort}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-xs">
                {message.trace_id}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{formatRelative(message.created_at)}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{formatAbsolute(message.created_at)}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
