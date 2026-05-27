/**
 * WhitelistAddDialog — modal de "Adicionar à whitelist" (ACs 21-28).
 *
 * Phone input filtra non-digits onChange (AC22). Submit valida regex E.164.
 * Modo via RadioGroup com `block` default. Reason opcional max 500 chars.
 */

"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { digitsOnly, isValidPhone } from "@/lib/format/phone";
import type { WhitelistMode } from "@/lib/hooks/use-whitelist";

interface Props {
  onAdd: (input: { phone: string; mode: WhitelistMode; reason: string | null }) => Promise<boolean>;
  mutating: boolean;
}

const REASON_MAX = 500;

export function WhitelistAddDialog({ onAdd, mutating }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<WhitelistMode>("block");
  const [reason, setReason] = useState("");

  const phoneId = useId();
  const reasonId = useId();
  const radioName = useId();

  const reset = (): void => {
    setPhone("");
    setMode("block");
    setReason("");
  };

  const phoneValid = isValidPhone(phone);
  const canSubmit = phoneValid && !mutating;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    const ok = await onAdd({
      phone,
      mode,
      reason: reason.trim() ? reason.trim() : null,
    });
    if (ok) {
      reset();
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à whitelist</DialogTitle>
          <DialogDescription>
            Configure o comportamento do bot para um número específico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor={phoneId}>Telefone (com DDD, sem +)</Label>
            <Input
              id={phoneId}
              value={phone}
              onChange={(e) => setPhone(digitsOnly(e.target.value))}
              placeholder="5511964540007"
              inputMode="numeric"
              maxLength={15}
              autoComplete="off"
              autoFocus
              className="font-mono"
            />
            {phone.length > 0 && !phoneValid ? (
              <p className="text-xs text-red-600">
                Formato inválido. Esperado: 10 a 15 dígitos (ex: 5511964540007).
              </p>
            ) : null}
          </div>

          {/* Mode */}
          <div className="space-y-1.5">
            <Label>Modo</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as WhitelistMode)}
              className="space-y-1.5"
            >
              <RadioOption
                value="allow"
                title="Allow (sem efeito, apenas marca)"
                description="Marca o número como reconhecido; bot opera normalmente."
                groupName={radioName}
              />
              <RadioOption
                value="block"
                title="Block (bot ignora completamente)"
                description="Bot não responde a mensagens deste número."
                groupName={radioName}
              />
              <RadioOption
                value="human_only"
                title="Human only (humano responde)"
                description="Atendimento humano via WhatsApp; bot fica silencioso."
                groupName={radioName}
              />
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>
              Motivo <span className="text-zinc-500">(opcional)</span>
            </Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              placeholder="Cliente VIP, Tiago atende direto"
              rows={2}
              maxLength={REASON_MAX}
            />
            <p className="text-right text-[11px] text-zinc-400">
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutating}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {mutating ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioOption({
  value,
  title,
  description,
  groupName,
}: {
  value: WhitelistMode;
  title: string;
  description: string;
  groupName: string;
}): React.ReactElement {
  const id = `${groupName}-${value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-2 transition hover:bg-zinc-50"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex-1">
        <span className="block text-sm font-medium text-[#1A1A2E]">{title}</span>
        <span className="block text-xs text-zinc-600">{description}</span>
      </span>
    </label>
  );
}
