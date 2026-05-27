/**
 * Bot whitelist helper — read/write em `bot_whitelist`.
 *
 * Side effects (audit log) ficam no handler. I/O puro aqui.
 *
 * Schema:
 *   bot_whitelist(phone VARCHAR(20) PK, mode TEXT CHECK IN ('allow','block','human_only'),
 *                 reason TEXT, added_by UUID, added_at TIMESTAMPTZ)
 */

import { query } from "./db";

export type WhitelistMode = "allow" | "block" | "human_only";

export interface WhitelistRow {
  phone: string;
  mode: WhitelistMode;
  reason: string | null;
  added_by_email: string | null;
  added_at: string; // ISO
}

interface DbWhitelistRow {
  phone: string;
  mode: WhitelistMode;
  reason: string | null;
  added_by_email: string | null;
  added_at: Date;
}

export async function listWhitelist(mode?: WhitelistMode): Promise<WhitelistRow[]> {
  const rows = mode
    ? await query<DbWhitelistRow>(
        `SELECT bw.phone, bw.mode, bw.reason, u.email AS added_by_email, bw.added_at
           FROM bot_whitelist bw
           LEFT JOIN admin_users u ON u.id = bw.added_by
          WHERE bw.mode = $1
          ORDER BY bw.added_at DESC`,
        [mode],
      )
    : await query<DbWhitelistRow>(
        `SELECT bw.phone, bw.mode, bw.reason, u.email AS added_by_email, bw.added_at
           FROM bot_whitelist bw
           LEFT JOIN admin_users u ON u.id = bw.added_by
          ORDER BY bw.added_at DESC`,
      );
  return rows.map((r) => ({
    phone: r.phone,
    mode: r.mode,
    reason: r.reason,
    added_by_email: r.added_by_email,
    added_at: r.added_at.toISOString(),
  }));
}

/** Upsert. Returns `{ before: row | null, after: row }` for audit. */
export async function upsertWhitelist(
  phone: string,
  mode: WhitelistMode,
  reason: string | null,
  addedBy: string,
): Promise<{ before: WhitelistRow | null; after: WhitelistRow }> {
  const existing = await query<DbWhitelistRow>(
    `SELECT bw.phone, bw.mode, bw.reason, u.email AS added_by_email, bw.added_at
       FROM bot_whitelist bw
       LEFT JOIN admin_users u ON u.id = bw.added_by
      WHERE bw.phone = $1`,
    [phone],
  );

  await query(
    `INSERT INTO bot_whitelist (phone, mode, reason, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO UPDATE
       SET mode = EXCLUDED.mode,
           reason = EXCLUDED.reason,
           added_by = EXCLUDED.added_by,
           added_at = NOW()`,
    [phone, mode, reason, addedBy],
  );

  const after = await query<DbWhitelistRow>(
    `SELECT bw.phone, bw.mode, bw.reason, u.email AS added_by_email, bw.added_at
       FROM bot_whitelist bw
       LEFT JOIN admin_users u ON u.id = bw.added_by
      WHERE bw.phone = $1`,
    [phone],
  );

  const beforeRow = existing[0];
  const afterRow = after[0]!;

  return {
    before: beforeRow
      ? {
          phone: beforeRow.phone,
          mode: beforeRow.mode,
          reason: beforeRow.reason,
          added_by_email: beforeRow.added_by_email,
          added_at: beforeRow.added_at.toISOString(),
        }
      : null,
    after: {
      phone: afterRow.phone,
      mode: afterRow.mode,
      reason: afterRow.reason,
      added_by_email: afterRow.added_by_email,
      added_at: afterRow.added_at.toISOString(),
    },
  };
}

/** Returns deleted row for audit, or null if not found. */
export async function removeWhitelist(phone: string): Promise<WhitelistRow | null> {
  const deleted = await query<DbWhitelistRow>(
    `DELETE FROM bot_whitelist
      WHERE phone = $1
      RETURNING phone, mode, reason, added_at, NULL::TEXT AS added_by_email`,
    [phone],
  );
  const row = deleted[0];
  if (!row) return null;
  return {
    phone: row.phone,
    mode: row.mode,
    reason: row.reason,
    added_by_email: row.added_by_email,
    added_at: row.added_at.toISOString(),
  };
}
