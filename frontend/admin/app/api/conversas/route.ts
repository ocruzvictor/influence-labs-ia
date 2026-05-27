/**
 * /api/conversas
 *
 *   GET → lista paginada de conversas (cursor por last_msg_at DESC)
 *
 * Cache LRU 2s no helper para absorver polling de múltiplas abas.
 * Auth via proxy.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listConversations } from "@/lib/conversas";

const querySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).default("all"),
  takeover: z.enum(["all", "yes", "no"]).default("all"),
  search: z.string().max(50).nullish(),
  cursor: z.string().datetime({ offset: true }).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "invalid_query",
        code: "validation",
      },
      { status: 400 },
    );
  }

  const result = await listConversations({
    status: parsed.data.status,
    takeover: parsed.data.takeover,
    search: parsed.data.search ?? null,
    cursor: parsed.data.cursor ?? null,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result);
}
