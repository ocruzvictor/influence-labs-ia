/**
 * /api/toggles
 *
 *   GET   → lista todos os toggles em bot_toggles
 *   PATCH → atualiza enabled de um toggle, registra audit
 *
 * Auth: proxy.ts já valida JWT + session. Handler usa getCurrentUser() para
 * descobrir QUEM fez a mutação (audit log + updated_by).
 *
 * Propagação no bot: backend/lib/bot-state.js refaz cache a cada 5s.
 * Toggle aplica no fluxo de mensagens em ≤5s sem restart.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listToggles, setToggle } from "@/lib/toggles";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const patchBodySchema = z.object({
  key: z.string().regex(/^[a-z_]+(:[a-z_]+)?$/, "invalid_key_format"),
  enabled: z.boolean(),
});

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const toggles = await listToggles();
  return NextResponse.json({ toggles });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof patchBodySchema>;
  try {
    const json: unknown = await req.json();
    body = patchBodySchema.parse(json);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "invalid_body" : "invalid_body";
    return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
  }

  const result = await setToggle(body.key, body.enabled, user.id);
  if (!result) {
    return NextResponse.json(
      { error: "toggle_not_found", code: "not_found" },
      { status: 404 },
    );
  }

  await logAudit({
    action: "toggle.set",
    userId: user.id,
    targetType: "bot_toggle",
    targetId: body.key,
    payload: { before: result.before, after: result.after },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ toggle: result.row });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
