/**
 * KB domain helpers (SERVER-ONLY) — read/write em `kb_items` + `kb_versions`.
 *
 * Este arquivo importa `pg` via lib/db. NÃO pode ser importado por client components.
 * Para types + pure helpers compartilhados, use `lib/kb-types.ts`.
 *
 * Schema (infra/migrations/001 + 003):
 *   kb_items(id UUID PK, slug TEXT UNIQUE, category TEXT, title, content_md,
 *            version INT, active BOOL, source_file, tess_memory_id BIGINT,
 *            deleted_at, tess_sync_failed_at, tess_sync_error,
 *            updated_by, updated_at, created_at)
 *   kb_versions(id BIGSERIAL PK, kb_item_id UUID FK, version INT, content_md,
 *               diff_summary, updated_by, created_at, UNIQUE(item_id, version))
 */

import "server-only";
import type { PoolClient } from "pg";
import { pool, query, withTx } from "./db";
import type { KbItem, KbVersion, KbCategory } from "./kb-types";

// Re-export pra route handlers que consomem ambos
export { KB_CATEGORIES, slugify, diffSummary, formatMemoryForTess } from "./kb-types";
export type { KbItem, KbVersion, KbCategory } from "./kb-types";

interface DbKbRow {
  id: string;
  slug: string;
  category: KbCategory;
  title: string;
  content_md: string;
  version: number;
  active: boolean;
  tess_memory_id: number | null;
  tess_sync_failed_at: Date | null;
  tess_sync_error: string | null;
  updated_by_email: string | null;
  updated_at: Date;
  created_at: Date;
}

function rowToItem(row: DbKbRow): KbItem {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    content_md: row.content_md,
    version: row.version,
    active: row.active,
    tess_memory_id: row.tess_memory_id,
    tess_sync_failed_at: row.tess_sync_failed_at ? row.tess_sync_failed_at.toISOString() : null,
    tess_sync_error: row.tess_sync_error,
    updated_by_email: row.updated_by_email,
    updated_at: row.updated_at.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

const ITEM_SELECT = `
  SELECT k.id, k.slug, k.category, k.title, k.content_md, k.version, k.active,
         k.tess_memory_id, k.tess_sync_failed_at, k.tess_sync_error,
         u.email AS updated_by_email,
         k.updated_at, k.created_at
    FROM kb_items k
    LEFT JOIN admin_users u ON u.id = k.updated_by
`;

// =============================================================================
// Reads
// =============================================================================

export async function listKbItems(): Promise<KbItem[]> {
  const rows = await query<DbKbRow>(
    `${ITEM_SELECT}
      WHERE k.deleted_at IS NULL
      ORDER BY k.category, k.title`,
  );
  return rows.map(rowToItem);
}

export async function getKbItemById(id: string): Promise<KbItem | null> {
  const rows = await query<DbKbRow>(
    `${ITEM_SELECT} WHERE k.id = $1 AND k.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function getKbItemBySlug(slug: string): Promise<KbItem | null> {
  const rows = await query<DbKbRow>(
    `${ITEM_SELECT} WHERE k.slug = $1 AND k.deleted_at IS NULL LIMIT 1`,
    [slug],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function listKbVersions(itemId: string, limit = 50): Promise<KbVersion[]> {
  const rows = await query<{
    id: number;
    kb_item_id: string;
    version: number;
    content_md: string;
    diff_summary: string | null;
    updated_by_email: string | null;
    created_at: Date;
  }>(
    `SELECT v.id, v.kb_item_id, v.version, v.content_md, v.diff_summary,
            u.email AS updated_by_email, v.created_at
       FROM kb_versions v
       LEFT JOIN admin_users u ON u.id = v.updated_by
      WHERE v.kb_item_id = $1
      ORDER BY v.version DESC
      LIMIT $2`,
    [itemId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    kb_item_id: r.kb_item_id,
    version: r.version,
    content_md: r.content_md,
    diff_summary: r.diff_summary,
    updated_by_email: r.updated_by_email,
    created_at: r.created_at.toISOString(),
  }));
}

// =============================================================================
// Mutations — Postgres only; TESS sync orchestrated by route handlers
// =============================================================================

export interface CreateKbInput {
  slug: string;
  category: KbCategory;
  title: string;
  content_md: string;
  updated_by: string;
}

/** Cria item v1. Caller deve depois chamar TESS createMemory e patchTessMemoryId. */
export async function createKbItem(input: CreateKbInput): Promise<KbItem> {
  const rows = await query<DbKbRow>(
    `INSERT INTO kb_items (slug, category, title, content_md, version, active, updated_by)
     VALUES ($1, $2, $3, $4, 1, TRUE, $5)
     RETURNING id, slug, category, title, content_md, version, active,
               tess_memory_id, tess_sync_failed_at, tess_sync_error,
               NULL::text AS updated_by_email, updated_at, created_at`,
    [input.slug, input.category, input.title, input.content_md, input.updated_by],
  );
  return rowToItem(rows[0]!);
}

/** Persiste tess_memory_id (chamado após createMemory bem-sucedido em TESS). */
export async function patchTessMemoryId(itemId: string, memoryId: number): Promise<void> {
  await query(
    `UPDATE kb_items
        SET tess_memory_id = $2,
            tess_sync_failed_at = NULL,
            tess_sync_error = NULL
      WHERE id = $1`,
    [itemId, memoryId],
  );
}

/** Marca falha de sync TESS (após commit Postgres). */
export async function markTessSyncFailed(itemId: string, error: string): Promise<void> {
  const trimmed = error.length > 500 ? error.slice(0, 500) : error;
  await query(
    `UPDATE kb_items
        SET tess_sync_failed_at = NOW(),
            tess_sync_error = $2
      WHERE id = $1`,
    [itemId, trimmed],
  );
}

/** Marca sucesso de sync (limpa flags de erro). */
export async function clearTessSyncFailure(itemId: string): Promise<void> {
  await query(
    `UPDATE kb_items
        SET tess_sync_failed_at = NULL,
            tess_sync_error = NULL
      WHERE id = $1`,
    [itemId],
  );
}

/** Limpa tess_memory_id (usado quando item é desativado e memory removida do TESS). */
export async function clearTessMemoryId(itemId: string): Promise<void> {
  await query(
    `UPDATE kb_items
        SET tess_memory_id = NULL,
            tess_sync_failed_at = NULL,
            tess_sync_error = NULL
      WHERE id = $1`,
    [itemId],
  );
}

/** Rollback compensatório: deleta item recém-criado (uso em POST quando TESS falha). */
export async function deleteKbItemHard(itemId: string): Promise<void> {
  await query(`DELETE FROM kb_items WHERE id = $1`, [itemId]);
}

export interface UpdateKbResult {
  item: KbItem;
  previousVersion: number;
  previousContent: string;
  unchanged: boolean;
}

/**
 * Update transactional: SELECT FOR UPDATE → INSERT version snapshot → UPDATE.
 * Se title+content iguais ao current: retorna unchanged=true sem mutar.
 */
export async function updateKbItem(
  itemId: string,
  title: string,
  contentMd: string,
  updatedBy: string,
  diffSummary: string,
): Promise<UpdateKbResult | null> {
  return await withTx(async (client: PoolClient) => {
    const cur = await client.query<DbKbRow>(
      `SELECT id, slug, category, title, content_md, version, active,
              tess_memory_id, tess_sync_failed_at, tess_sync_error,
              NULL::text AS updated_by_email, updated_at, created_at
         FROM kb_items
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [itemId],
    );
    const row = cur.rows[0];
    if (!row) return null;

    if (row.title === title && row.content_md === contentMd) {
      return {
        item: rowToItem(row),
        previousVersion: row.version,
        previousContent: row.content_md,
        unchanged: true,
      };
    }

    // Snapshot da versão atual em kb_versions ANTES de update
    await client.query(
      `INSERT INTO kb_versions (kb_item_id, version, content_md, diff_summary, updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemId, row.version, row.content_md, diffSummary, updatedBy],
    );

    const newVersion = row.version + 1;
    const upd = await client.query<DbKbRow>(
      `UPDATE kb_items
          SET title = $2, content_md = $3, version = $4, updated_by = $5
        WHERE id = $1
        RETURNING id, slug, category, title, content_md, version, active,
                  tess_memory_id, tess_sync_failed_at, tess_sync_error,
                  NULL::text AS updated_by_email, updated_at, created_at`,
      [itemId, title, contentMd, newVersion, updatedBy],
    );

    return {
      item: rowToItem(upd.rows[0]!),
      previousVersion: row.version,
      previousContent: row.content_md,
      unchanged: false,
    };
  });
}

export interface ToggleActiveResult {
  item: KbItem;
  before: boolean;
  after: boolean;
  tessMemoryIdBefore: number | null;
}

/** Toggle active e retorna estado. Caller faz sync TESS (delete/create memory). */
export async function toggleKbItemActive(
  itemId: string,
  active: boolean,
  updatedBy: string,
): Promise<ToggleActiveResult | null> {
  const cur = await query<DbKbRow>(
    `SELECT id, slug, category, title, content_md, version, active,
            tess_memory_id, tess_sync_failed_at, tess_sync_error,
            NULL::text AS updated_by_email, updated_at, created_at
       FROM kb_items
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [itemId],
  );
  const row = cur[0];
  if (!row) return null;

  if (row.active === active) {
    return {
      item: rowToItem(row),
      before: row.active,
      after: row.active,
      tessMemoryIdBefore: row.tess_memory_id,
    };
  }

  const upd = await query<DbKbRow>(
    `UPDATE kb_items
        SET active = $2, updated_by = $3
      WHERE id = $1
      RETURNING id, slug, category, title, content_md, version, active,
                tess_memory_id, tess_sync_failed_at, tess_sync_error,
                NULL::text AS updated_by_email, updated_at, created_at`,
    [itemId, active, updatedBy],
  );
  return {
    item: rowToItem(upd[0]!),
    before: row.active,
    after: active,
    tessMemoryIdBefore: row.tess_memory_id,
  };
}

/** Soft delete (marca deleted_at). Caller faz delete_memory no TESS. */
export async function softDeleteKbItem(
  itemId: string,
  deletedBy: string,
): Promise<{ item: KbItem; tessMemoryIdBefore: number | null } | null> {
  const cur = await query<DbKbRow>(
    `UPDATE kb_items
        SET deleted_at = NOW(), updated_by = $2
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, slug, category, title, content_md, version, active,
                tess_memory_id, tess_sync_failed_at, tess_sync_error,
                NULL::text AS updated_by_email, updated_at, created_at`,
    [itemId, deletedBy],
  );
  const row = cur[0];
  if (!row) return null;
  return { item: rowToItem(row), tessMemoryIdBefore: row.tess_memory_id };
}

/** Restore de versão antiga: cria NOVA versão (não sobrescreve histórico). */
export async function restoreKbVersion(
  itemId: string,
  targetVersion: number,
  updatedBy: string,
): Promise<UpdateKbResult | null> {
  return await withTx(async (client: PoolClient) => {
    // Lock current item
    const cur = await client.query<DbKbRow>(
      `SELECT id, slug, category, title, content_md, version, active,
              tess_memory_id, tess_sync_failed_at, tess_sync_error,
              NULL::text AS updated_by_email, updated_at, created_at
         FROM kb_items
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [itemId],
    );
    const row = cur.rows[0];
    if (!row) return null;

    // Buscar versão target
    const ver = await client.query<{ content_md: string }>(
      `SELECT content_md FROM kb_versions WHERE kb_item_id = $1 AND version = $2 LIMIT 1`,
      [itemId, targetVersion],
    );
    const target = ver.rows[0];
    if (!target) throw new Error(`version_not_found:${targetVersion}`);

    if (target.content_md === row.content_md) {
      // No-op: target idêntico ao atual
      return {
        item: rowToItem(row),
        previousVersion: row.version,
        previousContent: row.content_md,
        unchanged: true,
      };
    }

    // Snapshot v atual
    await client.query(
      `INSERT INTO kb_versions (kb_item_id, version, content_md, diff_summary, updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemId, row.version, row.content_md, `restored from v${targetVersion}`, updatedBy],
    );

    const newVersion = row.version + 1;
    const upd = await client.query<DbKbRow>(
      `UPDATE kb_items
          SET content_md = $2, version = $3, updated_by = $4
        WHERE id = $1
        RETURNING id, slug, category, title, content_md, version, active,
                  tess_memory_id, tess_sync_failed_at, tess_sync_error,
                  NULL::text AS updated_by_email, updated_at, created_at`,
      [itemId, target.content_md, newVersion, updatedBy],
    );

    return {
      item: rowToItem(upd.rows[0]!),
      previousVersion: row.version,
      previousContent: row.content_md,
      unchanged: false,
    };
  });
}

// Pure helpers (slugify, diffSummary, formatMemoryForTess, KB_CATEGORIES) e
// types (KbItem, KbVersion, KbCategory) vivem em ./kb-types.ts e são re-exportados
// no topo deste arquivo. Mantém kb.ts server-only (importa pg) e kb-types.ts client-safe.
