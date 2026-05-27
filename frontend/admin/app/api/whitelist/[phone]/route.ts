/**
 * /api/whitelist/[phone]
 *
 *   DELETE → remove phone do whitelist
 *
 * Auth via proxy.ts. Handler usa getCurrentUser() pra audit.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { removeWhitelist } from "@/lib/whitelist";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const phoneSchema = z.string().regex(/^\d{10,15}$/);

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { phone: rawPhone } = await ctx.params;
  const parsedPhone = phoneSchema.safeParse(rawPhone);
  if (!parsedPhone.success) {
    return NextResponse.json(
      { error: "invalid_phone_format", code: "validation" },
      { status: 400 },
    );
  }

  const deleted = await removeWhitelist(parsedPhone.data);
  if (!deleted) {
    return NextResponse.json(
      { error: "whitelist_not_found", code: "not_found" },
      { status: 404 },
    );
  }

  await logAudit({
    action: "whitelist.remove",
    userId: user.id,
    targetType: "bot_whitelist",
    targetId: parsedPhone.data,
    payload: { removed: deleted },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return new NextResponse(null, { status: 204 });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
