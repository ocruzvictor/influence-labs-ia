/**
 * Server-only session reader. Use in Server Components / Server Actions
 * to get the currently authenticated admin user.
 *
 * Returns null if cookie is missing/invalid OR session was revoked.
 * The proxy already gates routes, but call this in protected layouts to
 * fetch user data for rendering (avatar, name, role).
 */

import { cookies } from "next/headers";
import { cache } from "react";
import { query } from "./db";
import { checkSession, verifyJWT } from "./auth";

const SESSION_COOKIE = "session";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
}

/**
 * Memoized per-request — safe to call multiple times in a render pass.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload?.jti) return null;

  const stillValid = await checkSession(payload.jti);
  if (!stillValid) return null;

  const rows = await query<CurrentUser & { active: boolean }>(
    `SELECT id, email, name, role, active
       FROM admin_users
      WHERE id = $1
      LIMIT 1`,
    [payload.sub],
  );
  const row = rows[0];
  if (!row || !row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
});
