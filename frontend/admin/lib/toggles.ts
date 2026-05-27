/**
 * Bot toggles helper — read/write em `bot_toggles`.
 *
 * Side effects (audit log) ficam no handler, não aqui. Esta lib é I/O puro.
 *
 * Schema (infra/migrations/001_admin_dashboard.sql):
 *   bot_toggles(key TEXT PK, enabled BOOLEAN, description TEXT, updated_by UUID, updated_at TIMESTAMPTZ)
 */

import { query } from "./db";

export interface ToggleRow {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string; // ISO
}

interface DbToggleRow {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: Date;
}

export async function listToggles(): Promise<ToggleRow[]> {
  const rows = await query<DbToggleRow>(
    `SELECT key, enabled, description, updated_at
       FROM bot_toggles
      ORDER BY key`,
  );
  return rows.map((r) => ({
    key: r.key,
    enabled: r.enabled,
    description: r.description,
    updated_at: r.updated_at.toISOString(),
  }));
}

/** Returns `{ before, after, row }` if key existed, `null` if not found (caller returns 404). */
export async function setToggle(
  key: string,
  enabled: boolean,
  updatedBy: string,
): Promise<{ before: boolean; after: boolean; row: ToggleRow } | null> {
  const current = await query<{ enabled: boolean }>(
    `SELECT enabled FROM bot_toggles WHERE key = $1`,
    [key],
  );
  if (current.length === 0) return null;
  const before = current[0]!.enabled;

  const updated = await query<DbToggleRow>(
    `UPDATE bot_toggles
        SET enabled = $2, updated_by = $3
      WHERE key = $1
      RETURNING key, enabled, description, updated_at`,
    [key, enabled, updatedBy],
  );
  const row = updated[0]!;
  return {
    before,
    after: row.enabled,
    row: {
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      updated_at: row.updated_at.toISOString(),
    },
  };
}
