/**
 * /api/kb/[id]/restore/[version]
 *
 *   POST → restaura conteúdo de uma versão antiga, criando NOVA versão
 *          (não sobrescreve histórico). Sync TESS pós-commit.
 *
 * Story: 1.5 (KB editor) — AC30
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  restoreKbVersion,
  markTessSyncFailed,
  clearTessSyncFailure,
  formatMemoryForTess,
} from "@/lib/kb";
import { updateMemory, TessError } from "@/lib/tess-client";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const uuidSchema = z.string().uuid();
const versionSchema = z.coerce.number().int().min(1);

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; version: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!env.TIRRA_KB_COLLECTION_ID) {
    return NextResponse.json(
      { error: "kb_not_configured", code: "service_unavailable" },
      { status: 503 },
    );
  }

  const { id: rawId, version: rawVersion } = await ctx.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid_id", code: "validation" }, { status: 400 });
  }
  const parsedVersion = versionSchema.safeParse(rawVersion);
  if (!parsedVersion.success) {
    return NextResponse.json({ error: "invalid_version", code: "validation" }, { status: 400 });
  }
  const itemId = parsedId.data;
  const targetVersion = parsedVersion.data;

  let result;
  try {
    result = await restoreKbVersion(itemId, targetVersion, user.id);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (msg.startsWith("version_not_found:")) {
      return NextResponse.json(
        { error: "version_not_found", code: "not_found", version: targetVersion },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "db_error", code: "internal", detail: msg.slice(0, 300) },
      { status: 500 },
    );
  }

  if (!result) {
    return NextResponse.json({ error: "kb_item_not_found", code: "not_found" }, { status: 404 });
  }

  if (result.unchanged) {
    return NextResponse.json({ item: result.item, unchanged: true }, { status: 200 });
  }

  // Sync TESS
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
      await markTessSyncFailed(itemId, `restore_failed:${errMsg}`);
      await logAudit({
        action: "kb.tess_sync_failed",
        userId: user.id,
        targetType: "kb_item",
        targetId: itemId,
        payload: { phase: "restore", target_version: targetVersion, error: errMsg },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: "tess_sync_failed",
          code: "bad_gateway",
          item_updated_locally: true,
          item: result.item,
          detail: "Restore aplicado no painel mas falha de sync TESS. Tentaremos novamente.",
        },
        { status: 502 },
      );
    }
  }

  await logAudit({
    action: "kb.restore",
    userId: user.id,
    targetType: "kb_item",
    targetId: itemId,
    payload: {
      slug: result.item.slug,
      version_before: result.previousVersion,
      version_after: result.item.version,
      restored_from_version: targetVersion,
    },
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
