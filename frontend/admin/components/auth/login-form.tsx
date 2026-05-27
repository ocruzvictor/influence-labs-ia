"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (pending) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Informe um email válido");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A2E]">
          Confira seu email
        </h2>
        <p className="text-sm text-zinc-600">
          Se <strong>{email}</strong> estiver cadastrado, enviamos um link de
          acesso. O link vale por 15 minutos e só funciona uma vez.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline"
        >
          Tentar outro email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="voce@studiotirra.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-[#1A1A2E] text-white hover:bg-[#2A2A4A]"
        disabled={pending}
      >
        {pending ? "Enviando…" : "Receber link de acesso"}
      </Button>
      <p className="text-xs leading-relaxed text-zinc-500">
        Você receberá um email com um link de acesso único. Sem senha, sem
        complicação.
      </p>
    </form>
  );
}
