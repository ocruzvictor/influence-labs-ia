/**
 * POST /api/auth/logout
 *
 * Revokes server-side session, clears cookie, redirects to /login.
 * Idempotent — works even if cookie is missing or session already revoked.
 */

import { NextResponse, type NextRequest } from "next/server";
import { revokeSession, verifyJWT } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const SESSION_COOKIE = "session";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let userId: string | null = null;

  if (token) {
    const payload = await verifyJWT(token);
    if (payload?.jti) {
      userId = payload.sub;
      await revokeSession(payload.jti).catch((err) => {
        console.error("[logout] revokeSession failed:", err);
      });
      await logAudit({
        action: "logout",
        userId,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }
  }

  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
