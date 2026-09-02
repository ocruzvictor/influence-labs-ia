/**
 * POST /api/conversas/[phone]/resume
 *
 * BFF → upstream POST /admin/conversations/:phone/resume (story 2).
 * Sessão obrigatória; token interno só server-side (X-Admin-Token).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";

export const phoneSchema = z.string().regex(/^\d{10,15}$/);

export const resumeBodySchema = z.object({
  note: z.string().trim().min(20).max(500),
});

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { phone: rawPhone } = await ctx.params;
  const phoneParsed = phoneSchema.safeParse(rawPhone);
  if (!phoneParsed.success) {
    return NextResponse.json(
      { error: "invalid_phone_format", code: "validation" },
      { status: 400 },
    );
  }

  let body: z.infer<typeof resumeBodySchema>;
  try {
    const json: unknown = await req.json();
    body = resumeBodySchema.parse(json);
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "invalid_body" : "invalid_body";
    return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
  }

  if (!env.BACKEND_INTERNAL_URL || !env.BACKEND_INTERNAL_TOKEN) {
    return NextResponse.json(
      { error: "backend_not_configured", code: "service_unavailable" },
      { status: 503 },
    );
  }

  const baseUrl = env.BACKEND_INTERNAL_URL.replace(/\/$/, "");
  const upstreamUrl = `${baseUrl}/admin/conversations/${phoneParsed.data}/resume`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": env.BACKEND_INTERNAL_TOKEN,
      },
      body: JSON.stringify({ note: body.note, actor: "admin" }),
      cache: "no-store",
    });

    const payload: unknown = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: "upstream_unreachable", code: "service_unavailable" },
      { status: 503 },
    );
  }
}
