/**
 * /api/kb
 *
 *   GET  → lista items (deleted_at IS NULL)
 *   POST → cria novo item v1 + sincroniza memory na TESS collection
 *
 * Padrão atomic: INSERT Postgres → createMemory TESS → patchTessMemoryId.
 * Se TESS falhar pós-INSERT: ROLLBACK (deleteKbItemHard) — item ainda nem existia.
 *
 * Auth via proxy.ts. Sessão obrigatória pra POST.
 *
 * Story: 1.5 (KB editor — Caminho B)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  listKbItems,
  createKbItem,
  getKbItemBySlug,
  deleteKbItemHard,
  patchTessMemoryId,
  markTessSyncFailed,
  formatMemoryForTess,
  KB_CATEGORIES,
} from "@/lib/kb";
import { createMemory, TessError } from "@/lib/tess-client";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const createBodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "invalid_slug_format"),
  category: z.enum(KB_CATEGORIES),
  title: z.string().min(1).max(200),
  content_md: z.string().min(1).max(32_000),
});

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const items = await listKbItems();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!env.TIRRA_KB_COLLECTION_ID) {
    return NextResponse.json(
      { error: "kb_not_configured", code: "service_unavailable", detail: "TIRRA_KB_COLLECTION_ID não configurado" },
      { status: 503 },
    );
  }
  const collectionId = Number(env.TIRRA_KB_COLLECTION_ID);

  let body: z.infer<typeof createBodySchema>;
  try {
    const json: unknown = await req.json();
    body = createBodySchema.parse(json);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "invalid_body" : "invalid_body";
    return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
  }

  // Conflict check antes do INSERT (mais barato que UNIQUE constraint fire)
  const existing = await getKbItemBySlug(body.slug);
  if (existing) {
    return NextResponse.json(
      { error: "slug_already_exists", code: "conflict" },
      { status: 409 },
    );
  }

  // 1) INSERT Postgres (sem tess_memory_id ainda)
  let item;
  try {
    item = await createKbItem({
      slug: body.slug,
      category: body.category,
      title: body.title,
      content_md: body.content_md,
      updated_by: user.id,
    });
  } catch (err) {
    // Race condition no UNIQUE (slug)? trata como conflict
    const msg = (err as Error).message || String(err);
    if (msg.includes("duplicate key") || msg.includes("kb_items_slug_key")) {
      return NextResponse.json({ error: "slug_already_exists", code: "conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error", code: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }

  // 2) createMemory TESS
  try {
    const memory = await createMemory(
      collectionId,
      formatMemoryForTess({ title: body.title, category: body.category, content_md: body.content_md }),
    );
    await patchTessMemoryId(item.id, memory.id);
    item.tess_memory_id = memory.id;
  } catch (err) {
    // Compensação total: deleta o item recém-criado (ainda não existia)
    const errMsg = err instanceof TessError ? `${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : String(err);
    try {
      await deleteKbItemHard(item.id);
    } catch (compErr) {
      // Compensação falhou — marca pra audit/cleanup manual
      await markTessSyncFailed(item.id, `create_failed:${errMsg}`);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: item.id,
        payload: { phase: "create", error: errMsg, compensation_error: String(compErr).slice(0, 200) },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: "tess_sync_failed",
          code: "bad_gateway",
          item_id: item.id,
          detail: "Item criado localmente mas falha de sync TESS + compensação. Cleanup manual necessário.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "tess_sync_failed", code: "bad_gateway", detail: errMsg },
      { status: 502 },
    );
  }

  // 3) Audit log de sucesso
  await logAudit({
    action: "kb.create",
    userId: user.id,
    targetType: "kb_item",
    targetId: item.id,
    payload: { slug: item.slug, category: item.category, title: item.title, tess_memory_id: item.tess_memory_id },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ item }, { status: 201 });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
