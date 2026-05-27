/**
 * Next.js 16 Proxy (formerly "middleware") — authentication gate.
 *
 * Why this file is named `proxy.ts`:
 *   Starting in Next.js 16 the convention is `proxy.ts`. Functionality is identical
 *   to Next 15's `middleware.ts`.
 *
 * Behavior:
 *   • Public paths (login/verify/auth API) → pass through.
 *   • All other paths → require valid JWT cookie AND active session row.
 *   • Invalid or expired → redirect to /login, clear cookie.
 *
 * Note: Next.js docs explicitly warn that Proxy should NOT do heavy auth
 * (no full DAL). We do ONE indexed query (checkSession) which is fast and
 * needed for instant revocation. Full data-access checks happen in route handlers.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT, checkSession, updateLastSeen } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/verify",
  "/api/auth/magic-link",
  "/api/auth/verify",
];

const SESSION_COOKIE = "session";

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Allow static + public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  const payload = await verifyJWT(token);
  if (!payload?.jti) return redirectToLogin(req, true);

  const valid = await checkSession(payload.jti);
  if (!valid) return redirectToLogin(req, true);

  // Fire-and-forget; never blocks the request
  updateLastSeen(payload.jti).catch(() => {
    /* swallow */
  });

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest, clearCookie = false): NextResponse {
  const loginUrl = new URL("/login", req.url);
  // Preserve return path (but not query secrets)
  if (req.nextUrl.pathname !== "/" && !req.nextUrl.pathname.startsWith("/api/")) {
    loginUrl.searchParams.set("returnTo", req.nextUrl.pathname);
  }
  const res = NextResponse.redirect(loginUrl);
  if (clearCookie) res.cookies.delete(SESSION_COOKIE);
  return res;
}

// Match everything except Next internals and public assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
