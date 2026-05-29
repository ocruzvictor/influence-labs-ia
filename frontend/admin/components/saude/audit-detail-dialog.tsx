"use client";

/**
 * <AuditDetailDialog> — modal de detalhe de uma entry de audit_log.
 *
 * Story 1.7 AC26+AC63. Mostra metadata + payload JSON formatado + cópia.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatAbsolute } from "@/lib/format/date";
import type { AuditLogItem } from "@/lib/audit-log";

export function AuditDetailDialog({
  item,
  userAgent,
  open,
  onOpenChange,
}: {
  item: AuditLogItem | null;
  /** Não vem na listagem — passar separado se quiser exibir; caso contrário UI omite. */
  userAgent?: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(item.payload ?? {}, null, 2),
      );
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  // AC63: truncar UA em 80 chars
  const uaDisplay = userAgent ? userAgent.slice(0, 80) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item?.action ?? "—"}</DialogTitle>
          <DialogDescription>
            {item ? formatAbsolute(item.created_at) : "—"}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Usuário" value={item.user_email ?? "sistema"} />
              <Field label="Alvo" value={formatTarget(item)} />
              <Field label="IP" value={item.ip_address ?? "—"} />
              {uaDisplay && <Field label="User-Agent" value={uaDisplay} />}
            </dl>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-neutral-700">
                  Payload
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleCopy()}
                >
                  {copied ? "Copiado!" : "Copiar JSON"}
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto rounded-md bg-neutral-50 border border-neutral-200 p-3 text-xs font-mono">
                {JSON.stringify(item.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-neutral-500 min-w-[5rem]">{label}:</dt>
      <dd className="font-mono text-neutral-800 break-all">{value}</dd>
    </div>
  );
}

function formatTarget(item: AuditLogItem): string {
  if (!item.target_type && !item.target_id) return "—";
  if (item.target_type && item.target_id) {
    return `${item.target_type}:${item.target_id}`;
  }
  return item.target_type ?? item.target_id ?? "—";
}
