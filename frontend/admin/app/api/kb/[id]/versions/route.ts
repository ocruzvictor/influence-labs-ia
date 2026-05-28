/**
 * /api/kb/[id]/versions
 *
 *   GET → lista histórico de versões (DESC por version, limit 50)
 *
 * Story: 1.5 (KB editor) — AC27-32
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listKbVersions, getKbItemById } from "@/lib/kb";
import { getCurrentUser } from "@/lib/session";

const uuidSchema = z.string().uuid();

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: rawId } = await ctx.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid_id", code: "validation" }, { status: 400 });
  }
  const itemId = parsedId.data;

  const item = await getKbItemById(itemId);
  if (!item) {
    return NextResponse.json({ error: "kb_item_not_found", code: "not_found" }, { status: 404 });
  }

  const versions = await listKbVersions(itemId, 50);
  return NextResponse.json({ item, versions });
}
