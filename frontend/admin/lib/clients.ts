/**
 * Clients helper — read em `clients` (tabela de clientes do salão).
 *
 * Schema (infra/schema.sql):
 *   clients(id, trinks_client_id, phone UNIQUE, name, email, birth_date,
 *           last_service, last_visit, visit_count, opted_out, created_at, updated_at)
 *
 * Esta lib é I/O puro, server-only (lê via lib/db.ts → pool pg).
 * Importada APENAS por Server Components — nunca por client components.
 */

import { query } from "./db";

export interface ClientRow {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  last_service: string | null;
  last_visit: string | null; // ISO
  visit_count: number;
  opted_out: boolean;
}

interface DbClientRow {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  last_service: string | null;
  last_visit: Date | null;
  visit_count: number;
  opted_out: boolean;
}

export async function getClientByPhone(phone: string): Promise<ClientRow | null> {
  const rows = await query<DbClientRow>(
    `SELECT id, phone, name, email, last_service, last_visit, visit_count, opted_out
       FROM clients
      WHERE phone = $1
      LIMIT 1`,
    [phone],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    last_service: row.last_service,
    last_visit: row.last_visit ? row.last_visit.toISOString() : null,
    visit_count: row.visit_count,
    opted_out: row.opted_out,
  };
}
