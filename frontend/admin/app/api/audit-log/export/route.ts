/**
 * /api/audit-log/export
 *
 *   GET → streama CSV com os mesmos filtros de /api/audit-log.
 *
 * Story 1.7 AC33-AC38 + AC60-AC61.
 *
 * - Limite hardcoded 5.000 rows (proteção contra dump completo).
 * - Truncated → adiciona linha "# truncado" no fim.
 * - Auto-log `audit.export` ANTES de streamar (registra mesmo se download falhar).
 * - Escape RFC 4180 (quote wrap se contém vírgula/aspas/\n/\r; escape duplo de aspas).
 *
 * Auth: proxy.ts já valida sessão. Usa getCurrentUser() pra capturar quem exportou.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listAuditLog } from "@/lib/audit-log";
import { auditLogQuerySchema } from "@/lib/audit-log-query";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";

const EXPORT_LIMIT = 5000;

export const runtime = "nodejs";

function toCsvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  // RFC 4180: quote wrap se contém aspas, vírgula, \n, \r
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function GET(req: NextRequest): Promise<Response> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = auditLogQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "invalid_query",
        code: "validation",
      },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();

  // Default 7 dias (igual /api/audit-log)
  const since =
    parsed.data.since ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Auto-log ANTES de streamar (AC38)
  await logAudit({
    userId: user?.id ?? null,
    action: "audit.export",
    payload: {
      filters: {
        user_id: parsed.data.user_id ?? null,
        action: parsed.data.action ?? null,
        target_type: parsed.data.target_type ?? null,
        since,
        until: parsed.data.until ?? null,
      },
      limit: EXPORT_LIMIT,
      requested_at: new Date().toISOString(),
    },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  const { items, next_cursor } = await listAuditLog({
    userId: parsed.data.user_id ?? null,
    action: parsed.data.action ?? null,
    targetType: parsed.data.target_type ?? null,
    since,
    until: parsed.data.until ?? null,
    cursor: parsed.data.cursor ?? null,
    limit: EXPORT_LIMIT,
  });
  const truncated = next_cursor !== null;

  const header =
    "id,created_at,user_email,action,target_type,target_id,ip_address,payload_json\n";
  const rows = items
    .map((item) =>
      [
        item.id,
        item.created_at,
        item.user_email,
        item.action,
        item.target_type,
        item.target_id,
        item.ip_address,
        JSON.stringify(item.payload ?? {}),
      ]
        .map(toCsvField)
        .join(","),
    )
    .join("\n");
  const footer = truncated
    ? "\n# truncado: aplique filtros mais restritivos pra ver tudo\n"
    : "\n";

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14);
  const filename = `audit-log-${timestamp}.csv`;

  return new Response(header + rows + footer, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Exports para testes
export const __test = { toCsvField, EXPORT_LIMIT };
