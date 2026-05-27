/**
 * POST /api/auth/magic-link
 *
 * Body: { email: string }
 *
 * Always returns 200 `{ ok: true }` (never leaks whether email exists).
 * Side effects when email matches an active admin_user:
 *   • Generates token (32 random bytes, base64url).
 *   • Stores sha256(token) in magic_link_tokens (TTL 15min, single-use).
 *   • Sends email via Resend with link to /api/auth/verify?t={plaintext}.
 *   • Writes magic_link.sent to admin_audit_log.
 *
 * Rate limit: 3 req/min/email (in-memory LRU).
 * Timing attack mitigation: artificial delay when user not found.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import {
  generateMagicLinkToken,
  MAGIC_LINK_TTL_SECONDS,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { magicLinkLimiter } from "@/lib/rate-limit";
import { sendMagicLinkEmail } from "@/lib/emails/magic-link";

const bodySchema = z.object({
  email: z.string().email().max(254),
});

interface AdminRow {
  id: string;
  name: string;
}

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: { email: string };
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    // Generic response — don't leak parse errors to potential attackers
    return NextResponse.json({ ok: true });
  }

  const email = parsed.email.toLowerCase().trim();
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  const limit = magicLinkLimiter.check(email);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Retry-After": Math.ceil(limit.resetIn / 1000).toString(),
        },
      },
    );
  }

  const rows = await query<AdminRow>(
    `SELECT id, name FROM admin_users
      WHERE email = $1 AND active = TRUE
      LIMIT 1`,
    [email],
  );
  const user = rows[0];

  if (!user) {
    // Constant-ish work to obscure timing
    await sleep(200 + Math.random() * 200);
    return NextResponse.json({ ok: true });
  }

  const { plaintext, hash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000);

  await query(
    `INSERT INTO magic_link_tokens
       (token_hash, user_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [hash, user.id, expiresAt, ip ?? null, ua],
  );

  const link = `${env.ADMIN_PUBLIC_URL.replace(/\/$/, "")}/api/auth/verify?t=${plaintext}`;

  try {
    await sendMagicLinkEmail({ to: email, name: user.name, link });
  } catch (err) {
    // Log internally, still return ok=true (no enumeration).
    // Token is unusable without email delivery — burn it for safety.
    await query(`DELETE FROM magic_link_tokens WHERE token_hash = $1`, [hash]).catch(() => {});
    console.error("[magic-link] email send failed:", err);
    return NextResponse.json({ ok: true });
  }

  await logAudit({
    action: "magic_link.sent",
    userId: user.id,
    payload: { email },
    ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
