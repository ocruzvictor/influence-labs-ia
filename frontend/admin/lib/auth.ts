/**
 * Auth primitives: JWT sign/verify + session lifecycle in admin_sessions.
 *
 * Design (architecture §6):
 *  • JWT signed HS256 with ADMIN_JWT_SECRET, exp = 30d.
 *  • `jti` claim → row in admin_sessions; revoke = UPDATE revoked_at.
 *  • Magic-link tokens stored as sha256 hex — never plaintext.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";
import { query } from "./db";

// 30 days in seconds — keep in one place
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 min

const SECRET = new TextEncoder().encode(env.ADMIN_JWT_SECRET);

export interface AdminTokenPayload extends JWTPayload {
  sub: string; // user id (uuid)
  jti: string; // session id (uuid)
}

// ─── JWT ──────────────────────────────────────────────────────────────────

export async function signJWT(userId: string, jti: string): Promise<string> {
  return new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyJWT(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

// ─── Magic link tokens ────────────────────────────────────────────────────

/** Returns { plaintext, hash } — store hash in DB, mail plaintext to user. */
export function generateMagicLinkToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// ─── Session lifecycle ────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  ip?: string | null,
  ua?: string | null,
): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await query(
    `INSERT INTO admin_sessions (jti, user_id, expires_at, ip_address, device_label)
     VALUES ($1, $2, $3, $4, $5)`,
    [jti, userId, expiresAt, ip ?? null, deviceLabelFromUA(ua)],
  );
  return jti;
}

/** True if session is active (not revoked, not expired). */
export async function checkSession(jti: string): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT 1 AS ok
       FROM admin_sessions
      WHERE jti = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
    [jti],
  );
  return rows.length > 0;
}

export async function revokeSession(jti: string): Promise<void> {
  await query(`UPDATE admin_sessions SET revoked_at = NOW() WHERE jti = $1`, [jti]);
}

/** Fire-and-forget. Caller should `.catch(noop)`. */
export async function updateLastSeen(jti: string): Promise<void> {
  await query(`UPDATE admin_sessions SET last_seen_at = NOW() WHERE jti = $1`, [jti]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function deviceLabelFromUA(ua?: string | null): string | null {
  if (!ua) return null;
  // Lightweight detection — replace with ua-parser-js if richer info is needed
  const browser = /Chrome|Firefox|Safari|Edge|Opera/.exec(ua)?.[0] ?? "Browser";
  const os = /Mac|Windows|Linux|Android|iPhone|iPad/.exec(ua)?.[0] ?? "Unknown";
  return `${browser} on ${os}`.slice(0, 80);
}
