/**
 * /api/conversas/[phone]
 *
 *   GET → timeline paginada de uma conversa (cursor por created_at DESC)
 *
 * Sem cache — timeline precisa ser fresh.
 * Auth via proxy.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConversationTimeline } from "@/lib/conversas";

const phoneSchema = z.string().regex(/^\d{10,15}$/);

const querySchema = z.object({
  before: z.string().datetime({ offset: true }).nullish(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const { phone: rawPhone } = await ctx.params;
  const phoneParsed = phoneSchema.safeParse(rawPhone);
  if (!phoneParsed.success) {
    return NextResponse.json(
      { error: "invalid_phone_format", code: "validation" },
      { status: 400 },
    );
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const queryParsed = querySchema.safeParse(params);
  if (!queryParsed.success) {
    return NextResponse.json(
      {
        error: queryParsed.error.issues[0]?.message ?? "invalid_query",
        code: "validation",
      },
      { status: 400 },
    );
  }

  const result = await getConversationTimeline({
    phone: phoneParsed.data,
    before: queryParsed.data.before ?? null,
    limit: queryParsed.data.limit,
  });

  return NextResponse.json({
    phone: phoneParsed.data,
    ...result,
  });
}
