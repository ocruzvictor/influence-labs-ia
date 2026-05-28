/**
 * /api/kb/[id]/active
 *
 *   PATCH → toggle active (true ↔ false)
 *
 * Quando active=false: delete_memory TESS (memory órfã sumindo do RAG).
 * Quando active=true: create_memory TESS (recria entrada). patchTessMemoryId no sucesso.
 *
 * Story: 1.5 (KB editor) — AC23-26
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  toggleKbItemActive,
  patchTessMemoryId,
  clearTessMemoryId,
  markTessSyncFailed,
  clearTessSyncFailure,
  formatMemoryForTess,
} from "@/lib/kb";
import { createMemory, deleteMemory, TessError } from "@/lib/tess-client";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const uuidSchema = z.string().uuid();

const patchBodySchema = z.object({
  active: z.boolean(),
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
  const collectionId = Number(env.TIRRA_KB_COLLECTION_ID);

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

  const result = await toggleKbItemActive(itemId, body.active, user.id);
  if (!result) {
    return NextResponse.json({ error: "kb_item_not_found", code: "not_found" }, { status: 404 });
  }

  // No-op se já estava no estado pedido
  if (result.before === result.after) {
    return NextResponse.json({ item: result.item, unchanged: true });
  }

  // Sync TESS
  if (body.active && result.tessMemoryIdBefore === null) {
    // active true + memory ausente → create
    try {
      const memory = await createMemory(
        collectionId,
        formatMemoryForTess({
          title: result.item.title,
          category: result.item.category,
          content_md: result.item.content_md,
        }),
      );
      await patchTessMemoryId(itemId, memory.id);
      result.item.tess_memory_id = memory.id;
    } catch (err) {
      // Compensação: voltar pra active=false no Postgres
      const errMsg = err instanceof TessError ? `${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : String(err);
      await toggleKbItemActive(itemId, false, user.id).catch(() => {});
      await markTessSyncFailed(itemId, `activate_failed:${errMsg}`);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: itemId,
        payload: { phase: "activate", error: errMsg },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        { error: "tess_sync_failed", code: "bad_gateway", detail: errMsg },
        { status: 502 },
      );
    }
  } else if (!body.active && result.tessMemoryIdBefore !== null) {
    // active false + memory presente → delete
    try {
      await deleteMemory(result.tessMemoryIdBefore);
      await clearTessMemoryId(itemId);
      result.item.tess_memory_id = null;
    } catch (err) {
      const errMsg = err instanceof TessError ? `${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : String(err);
      await markTessSyncFailed(itemId, `deactivate_failed:${errMsg}`);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: itemId,
        payload: { phase: "deactivate", error: errMsg },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        { error: "tess_sync_failed", code: "bad_gateway", detail: errMsg },
        { status: 502 },
      );
    }
  } else {
    // Estado já consistente — nenhuma chamada TESS necessária
  }

  await clearTessSyncFailure(itemId);

  await logAudit({
    action: "kb.toggle_active",
    userId: user.id,
    targetType: "kb_item",
    targetId: itemId,
    payload: { slug: result.item.slug, before: result.before, after: result.after },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ item: result.item }, { status: 200 });
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? null;
}
