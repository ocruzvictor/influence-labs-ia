/**
 * Audit log query helper — leitura de admin_audit_log.
 * Escrita usa `lib/audit.ts` (logAudit).
 *
 * Schema (admin_audit_log):
 *   id BIGSERIAL PK, user_id UUID, action TEXT, target_type TEXT, target_id TEXT,
 *   payload JSONB, ip_address INET, user_agent TEXT, created_at TIMESTAMPTZ
 */

import { query } from "./db";

export interface AuditLogItem {
  id: string; // BIGSERIAL serializado como string pra evitar precision loss
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: unknown;
  ip_address: string | null;
  created_at: string; // ISO
}

interface DbAuditRow {
  id: string;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: unknown;
  ip_address: string | null;
  created_at: Date;
}

export interface AuditLogFilters {
  userId?: string | null;
  /** Match exato OU prefix (ex: 'toggle.*' vira 'toggle.%' no LIKE). */
  action?: string | null;
  targetType?: string | null;
  /** ISO timestamps. */
  since?: string | null;
  until?: string | null;
  /** Cursor pagination: id da última row da página anterior. */
  cursor?: string | null;
  limit?: number;
}

export async function listAuditLog(
  filters: AuditLogFilters,
): Promise<{ items: AuditLogItem[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const actionPattern = filters.action?.includes("*")
    ? filters.action.replace(/\*/g, "%")
    : filters.action ?? null;

  const rows = await query<DbAuditRow>(
    `SELECT a.id::TEXT, u.email AS user_email, a.action, a.target_type, a.target_id,
            a.payload, host(a.ip_address) AS ip_address, a.created_at
       FROM admin_audit_log a
       LEFT JOIN admin_users u ON u.id = a.user_id
      WHERE ($1::uuid IS NULL OR a.user_id = $1)
        AND ($2::text IS NULL OR a.action LIKE $2)
        AND ($3::text IS NULL OR a.target_type = $3)
        AND ($4::timestamptz IS NULL OR a.created_at >= $4)
        AND ($5::timestamptz IS NULL OR a.created_at <= $5)
        AND ($6::bigint IS NULL OR a.id < $6)
      ORDER BY a.id DESC
      LIMIT $7`,
    [
      filters.userId ?? null,
      actionPattern,
      filters.targetType ?? null,
      filters.since ?? null,
      filters.until ?? null,
      filters.cursor ?? null,
      limit,
    ],
  );

  const items: AuditLogItem[] = rows.map((r) => ({
    id: r.id,
    user_email: r.user_email,
    action: r.action,
    target_type: r.target_type,
    target_id: r.target_id,
    payload: r.payload,
    ip_address: r.ip_address,
    created_at: r.created_at.toISOString(),
  }));

  const next_cursor = items.length === limit ? items[items.length - 1]!.id : null;
  return { items, next_cursor };
}
