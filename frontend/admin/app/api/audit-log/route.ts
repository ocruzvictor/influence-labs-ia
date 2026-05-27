/**
 * /api/audit-log
 *
 *   GET → lista paginada (cursor) com filtros user_id, action, target_type, since, until
 *
 * READ-ONLY. Não há endpoint de DELETE/PATCH — audit é append-only.
 * Auth via proxy.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listAuditLog } from "@/lib/audit-log";

const querySchema = z.object({
  user_id: z.string().uuid().nullish(),
  action: z.string().max(100).nullish(),
  target_type: z.string().max(50).nullish(),
  since: z.string().datetime({ offset: true }).nullish(),
  until: z.string().datetime({ offset: true }).nullish(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z
    .string()
    .regex(/^\d+$/, "cursor_must_be_bigint")
    .nullish(),
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

  // Default: últimos 7 dias se since não foi passado
  const since =
    parsed.data.since ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { items, next_cursor } = await listAuditLog({
    userId: parsed.data.user_id ?? null,
    action: parsed.data.action ?? null,
    targetType: parsed.data.target_type ?? null,
    since,
    until: parsed.data.until ?? null,
    cursor: parsed.data.cursor ?? null,
    limit: parsed.data.limit,
  });

  return NextResponse.json({ items, next_cursor });
}
