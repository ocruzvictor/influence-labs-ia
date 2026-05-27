/**
 * Fallback page for /verify — server normally redirects from /api/auth/verify
 * straight to /. This page only renders if the user lands here without `?t`
 * (e.g. a bookmark or stale link).
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyFallbackPage(): React.ReactElement {
  return (
    <Card className="w-full max-w-md border-[rgba(26,26,46,0.08)] bg-white shadow-sm">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto text-xs uppercase tracking-[0.12em] text-zinc-500">
          Studio Tirra
        </div>
        <CardTitle className="text-xl font-semibold text-[#1A1A2E]">
          Link incompleto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-zinc-600">
        <p>
          Esta página recebe um token de magic link. Se você chegou aqui pelo
          email, abra o link diretamente do email — ele deve incluir{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">?t=…</code>.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-[#4338CA] hover:underline"
        >
          ← Voltar para o login
        </Link>
      </CardContent>
    </Card>
  );
}
