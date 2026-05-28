/**
 * /api/metricas
 *   GET ?period=7d&fresh=0 → KPIs + série diária + top profissionais
 *
 * Auth via proxy.ts. Cache LRU 60s no helper (bypass com ?fresh=1).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getMetrics } from "@/lib/metrics";

const querySchema = z.object({
  period: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
  fresh: z.coerce.boolean().default(false),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_query", code: "validation" },
      { status: 400 },
    );
  }

  try {
    const result = await getMetrics(parsed.data.period, parsed.data.fresh);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("[/api/metricas] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao consultar métricas", code: "internal" }, { status: 500 });
  }
}
