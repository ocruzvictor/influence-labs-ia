/**
 * /api/kb/[id]
 *
 *   PATCH  → update title/content (cria nova versão em kb_versions, syncs TESS)
 *   DELETE → soft delete (deleted_at = NOW, deleta memory TESS)
 *
 * Padrão atomic: COMMIT Postgres ANTES de chamar TESS. Em falha TESS pós-commit:
 *   markTessSyncFailed + audit kb.tess_sync_failed + 502 (mantém Postgres).
 *
 * Story: 1.5 (KB editor)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  updateKbItem,
  softDeleteKbItem,
  markTessSyncFailed,
  clearTessSyncFailure,
  diffSummary,
  formatMemoryForTess,
} from "@/lib/kb";
import { updateMemory, deleteMemory, TessError } from "@/lib/tess-client";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const uuidSchema = z.string().uuid();

const patchBodySchema = z.object({
  title: z.string().min(1).max(200),
  content_md: z.string().min(1).max(32_000),
});

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!env.TIRRA_KB_COLLECTION_ID) {
    return NextResponse.json(
      { error: "kb_not_configured", code: "service_unavailable" },
      { status: 503 },
    );
  }

  const { id: rawId } = await ctx.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid_id", code: "validation" }, { status: 400 });
  }
  const itemId = parsedId.data;

  let body: z.infer<typeof patchBodySchema>;
  try {
    const json: unknown = await req.json();
    body = patchBodySchema.parse(json);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "invalid_body" : "invalid_body";
    return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
  }

  // Lock-and-update no Postgres (snapshot kb_versions + bump version)
  let result;
  try {
    result = await updateKbItem(
      itemId,
      body.title,
      body.content_md,
      user.id,
      diffSummary("", body.content_md), // placeholder — recalculado abaixo
    );
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", code: "internal", detail: String(err).slice(0, 300) },
      { status: 500 },
    );
  }

  if (!result) {
    return NextResponse.json({ error: "kb_item_not_found", code: "not_found" }, { status: 404 });
  }

  // Skip se conteúdo igual (idempotência — AC22)
  if (result.unchanged) {
    return NextResponse.json({ item: result.item, unchanged: true }, { status: 200 });
  }

  // Recalcula diff_summary com valor real (caller passou placeholder)
  // (update_kb_item já gravou; o diff é informacional pra UI/audit)
  const realDiff = diffSummary(result.previousContent, body.content_md);

  // Sync TESS (pós-commit)
  const tessMemoryId = result.item.tess_memory_id;
  if (tessMemoryId !== null) {
    try {
      await updateMemory(
        tessMemoryId,
        formatMemoryForTess({
          title: result.item.title,
          category: result.item.category,
          content_md: result.item.content_md,
        }),
      );
      await clearTessSyncFailure(itemId);
    } catch (err) {
      const errMsg = err instanceof TessError ? `${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : String(err);
      await markTessSyncFailed(itemId, errMsg);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: itemId,
        payload: {
          phase: "update",
          version_after: result.item.version,
          error: errMsg,
        },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: "tess_sync_failed",
          code: "bad_gateway",
          item_updated_locally: true,
          item: result.item,
          detail: "Mudança salva no painel mas falhou ao sincronizar com TESS. Tentaremos novamente automaticamente.",
        },
        { status: 502 },
      );
    }
  }

  // Audit log sucesso
  await logAudit({
    action: "kb.update",
    userId: user.id,
    targetType: "kb_item",
    targetId: itemId,
    payload: {
      slug: result.item.slug,
      version_before: result.previousVersion,
      version_after: result.item.version,
      diff_summary: realDiff,
    },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ item: result.item, diff_summary: realDiff }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!env.TIRRA_KB_COLLECTION_ID) {
    return NextResponse.json(
      { error: "kb_not_configured", code: "service_unavailable" },
      { status: 503 },
    );
  }

  const { id: rawId } = await ctx.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid_id", code: "validation" }, { status: 400 });
  }
  const itemId = parsedId.data;

  // 1) Soft delete no Postgres
  const result = await softDeleteKbItem(itemId, user.id);
  if (!result) {
    return NextResponse.json({ error: "kb_item_not_found", code: "not_found" }, { status: 404 });
  }

  // 2) Delete memory TESS (pós-commit)
  if (result.tessMemoryIdBefore !== null) {
    try {
      await deleteMemory(result.tessMemoryIdBefore);
    } catch (err) {
      const errMsg = err instanceof TessError ? `${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : String(err);
      await markTessSyncFailed(itemId, `delete_failed:${errMsg}`);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: itemId,
        payload: { phase: "delete", tess_memory_id: result.tessMemoryIdBefore, error: errMsg },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: "tess_sync_failed",
          code: "bad_gateway",
          item_deleted_locally: true,
          detail: "Item deletado no painel mas memory órfã no TESS. Cleanup manual via TESS UI necessário.",
        },
        { status: 502 },
      );
    }
  }

  // Audit log sucesso
  await logAudit({
    action: "kb.delete",
    userId: user.id,
    targetType: "kb_item",
    targetId: itemId,
    payload: { slug: result.item.slug, tess_memory_id: result.tessMemoryIdBefore },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return new NextResponse(null, { status: 204 });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
