/**
 * ResumeIaDialog — orientação de operador para retomar IA pós-handoff.
 *
 * POST /api/conversas/[phone]/resume → BFF → Express resume (story 2).
 * Nota nunca vai pro browser log; toasts por status do contrato upstream.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MIN_NOTE = 20;
const MAX_NOTE = 500;

const CONFLICT_MESSAGES: Record<string, string> = {
  human_spoke_recently: "Humano falou nos últimos 10 min — aguarde antes de retomar.",
  human_only: "Bot pausado (human_only) — remova em /toggles antes de retomar.",
  blocked: "Número bloqueado — remova em /toggles antes de retomar.",
};

interface Props {
  phone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseResponseBody(raw: unknown): { status: string | null; error: string | null } {
  if (!raw || typeof raw !== "object") return { status: null, error: null };
  const obj = raw as Record<string, unknown>;
  return {
    status: typeof obj.status === "string" ? obj.status : null,
    error: typeof obj.error === "string" ? obj.error : null,
  };
}

export function ResumeIaDialog({ phone, open, onOpenChange }: Props): React.ReactElement {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = note.trim();
  const valid = trimmed.length >= MIN_NOTE && trimmed.length <= MAX_NOTE;

  const handleOpenChange = (next: boolean): void => {
    if (submitting) return;
    if (!next) setNote("");
    onOpenChange(next);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/conversas/${encodeURIComponent(phone)}/resume`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });

      const { status, error } = parseResponseBody(await res.json().catch(() => ({})));

      if (res.ok && status === "sent") {
        toast.success("IA retomada", { description: "Mensagem enviada ao cliente." });
        setNote("");
        onOpenChange(false);
        return;
      }

      if (res.ok && status === "window_closed") {
        toast.warning("Janela 24h fechada", {
          description: "Nota guardada — será usada na próxima mensagem da cliente.",
        });
        setNote("");
        onOpenChange(false);
        return;
      }

      if (res.ok && status === "already_active") {
        toast.info("Bot já ativo", { description: "Não há silêncio de handoff para retomar." });
        setNote("");
        onOpenChange(false);
        return;
      }

      if (res.status === 409) {
        const key = error ?? "conflict";
        toast.error("Não foi possível retomar", {
          description: CONFLICT_MESSAGES[key] ?? "Conflito com o estado atual.",
        });
        return;
      }

      if (res.status === 422 || res.status === 503 || res.status >= 500) {
        toast.error("Falha ao retomar IA", {
          description: error ?? `Erro do servidor (HTTP ${res.status})`,
        });
        return;
      }

      toast.error("Falha ao retomar IA", {
        description: error ?? `HTTP ${res.status}`,
      });
    } catch {
      toast.error("Falha ao retomar IA", { description: "Erro de rede." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>Retomar IA</DialogTitle>
          <DialogDescription>
            Orientação para a Tess retomar o atendimento. Não será enviada como mensagem da
            cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="resume-note" className="text-sm font-medium">
            Orientação para a IA
          </label>
          <Textarea
            id="resume-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Retoma o agendamento — confirmar data e horário do teste de mecha."
            rows={4}
            maxLength={MAX_NOTE}
            disabled={submitting}
            aria-invalid={note.length > 0 && !valid}
          />
          <p className="text-xs text-muted-foreground">
            {trimmed.length}/{MAX_NOTE} caracteres (mínimo {MIN_NOTE})
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            autoFocus
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!valid || submitting}>
            Retomar IA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
