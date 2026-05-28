/**
 * /api/admin-users
 *
 *   GET → lista admins ativos { id, email } pra alimentar filtros de UI.
 *
 * READ-ONLY (não há POST/PATCH — admins são criados via seed script).
 * Auth via proxy.ts.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface Row {
  id: string;
  email: string;
}

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const rows = await query<Row>(
    `SELECT id, email
       FROM admin_users
      WHERE active = TRUE
      ORDER BY email`,
  );
  return NextResponse.json({ users: rows });
}
