/**
 * /api/whitelist
 *
 *   GET   → lista (filtro opcional ?mode=allow|block|human_only)
 *   POST  → upsert phone+mode+reason
 *
 * Auth via proxy.ts. Handler usa getCurrentUser() pra audit + added_by.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listWhitelist, upsertWhitelist, type WhitelistMode } from "@/lib/whitelist";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const modeSchema = z.enum(["allow", "block", "human_only"]);

const postBodySchema = z.object({
  phone: z.string().regex(/^\d{10,15}$/, "invalid_phone_format"),
  mode: modeSchema,
  reason: z.string().max(500).nullish(),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const modeParam = req.nextUrl.searchParams.get("mode");
  let mode: WhitelistMode | undefined;
  if (modeParam) {
    const parsed = modeSchema.safeParse(modeParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_mode", code: "validation" },
        { status: 400 },
      );
    }
    mode = parsed.data;
  }
  const items = await listWhitelist(mode);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof postBodySchema>;
  try {
    const json: unknown = await req.json();
    body = postBodySchema.parse(json);
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "invalid_body" : "invalid_body";
    return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
  }

  const result = await upsertWhitelist(
    body.phone,
    body.mode,
    body.reason ?? null,
    user.id,
  );

  await logAudit({
    action: "whitelist.upsert",
    userId: user.id,
    targetType: "bot_whitelist",
    targetId: body.phone,
    payload: { before: result.before, after: result.after },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(
    { item: result.after },
    { status: result.before ? 200 : 201 },
  );
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
