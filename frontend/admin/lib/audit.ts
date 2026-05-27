/**
 * Audit log helper. Fail-silent (never throws — auth flow must not break on log failure).
 *
 * Schema (admin_audit_log):
 *   action TEXT NOT NULL — verb.object e.g. "login", "logout", "magic_link.sent",
 *                          "kb.update", "toggle.set", "whitelist.add"
 *   payload JSONB — diff or snapshot; for login: {} is fine
 */

import { query } from "./db";

export interface AuditEntry {
  action: string;
  userId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log
         (user_id, action, target_type, target_id, payload, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  } catch (err) {
    console.error("[audit] failed to log entry:", entry.action, err);
  }
}
