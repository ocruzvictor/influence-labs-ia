/**
 * GET /api/auth/verify?t={token}
 *
 * Consumes magic-link token, creates session, sets cookie, redirects to /.
 * Token validation rules (any failure → redirect /login?error={code}):
 *   • Token must hash to a row in magic_link_tokens.
 *   • consumed_at IS NULL (single-use).
 *   • expires_at > NOW() (15min TTL).
 */

import { NextResponse, type NextRequest } from "next/server";
import { query, withTx } from "@/lib/db";
import { env, isProd } from "@/lib/env";
import {
  SESSION_TTL_SECONDS,
  createSession,
  hashToken,
  signJWT,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const SESSION_COOKIE = "session";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return redirect(req, "/login?error=missing");

  const hash = hashToken(token);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  let userId: string;

  try {
    userId = await withTx<string>(async (client) => {
      // Lock row to prevent races on single-use enforcement
      const { rows } = await client.query<{
        user_id: string;
        consumed_at: Date | null;
        expires_at: Date;
      }>(
        `SELECT user_id, consumed_at, expires_at
           FROM magic_link_tokens
          WHERE token_hash = $1
          FOR UPDATE`,
        [hash],
      );

      const row = rows[0];
      if (!row) throw new VerifyError("invalid");
      if (row.consumed_at !== null) throw new VerifyError("consumed");
      if (row.expires_at.getTime() <= Date.now()) throw new VerifyError("expired");

      await client.query(
        `UPDATE magic_link_tokens SET consumed_at = NOW() WHERE token_hash = $1`,
        [hash],
      );
      await client.query(
        `UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`,
        [row.user_id],
      );
      return row.user_id;
    });
  } catch (err) {
    if (err instanceof VerifyError) return redirect(req, `/login?error=${err.code}`);
    console.error("[verify] unexpected error:", err);
    return redirect(req, "/login?error=server");
  }

  // Confirm the user is still active (could have been deactivated mid-window)
  const userRows = await query<{ active: boolean }>(
    `SELECT active FROM admin_users WHERE id = $1`,
    [userId],
  );
  if (!userRows[0]?.active) return redirect(req, "/login?error=inactive");

  const jti = await createSession(userId, ip, ua);
  const jwt = await signJWT(userId, jti);

  await logAudit({
    action: "login",
    userId,
    ip,
    userAgent: ua,
  });

  // Resolve safe internal returnTo (default /)
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const res = NextResponse.redirect(new URL(returnTo, env.ADMIN_PUBLIC_URL));
  res.cookies.set({
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

class VerifyError extends Error {
  constructor(public code: "invalid" | "consumed" | "expired") {
    super(code);
  }
}

function redirect(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url));
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";
  // Internal-only, no protocol-relative or absolute URLs
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login") || value.startsWith("/verify") || value.startsWith("/api/")) {
    return "/";
  }
  return value;
}
