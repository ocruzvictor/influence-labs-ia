/**
 * Conversas helper — queries em v_admin_conversations_summary + conversation_history.
 * LRU cache 2s para absorver polling de múltiplas abas.
 *
 * View:
 *   v_admin_conversations_summary(client_phone, msg_count, last_msg_at, first_msg_at,
 *                                  last_agent, is_active_4h, had_takeover)
 */

import { LRUCache } from "lru-cache";
import { query } from "./db";

// ─── Lista de conversas (sumário) ─────────────────────────────────────────

export interface ConversationSummary {
  client_phone: string;
  msg_count: number;
  last_msg_at: string; // ISO
  first_msg_at: string; // ISO
  last_agent: string | null;
  is_active_4h: boolean;
  had_takeover: boolean;
}

export type ConversationStatus = "all" | "active" | "inactive";
export type ConversationTakeover = "all" | "yes" | "no";

export interface ConversationListFilters {
  status: ConversationStatus;
  takeover: ConversationTakeover;
  search?: string | null;
  cursor?: string | null; // ISO timestamp da last_msg_at da página anterior
  limit?: number;
}

interface DbSummaryRow {
  client_phone: string;
  msg_count: string | number; // pg-node retorna BIGINT como string
  last_msg_at: Date;
  first_msg_at: Date;
  last_agent: string | null;
  is_active_4h: boolean;
  had_takeover: boolean;
}

const summaryCache = new LRUCache<string, { items: ConversationSummary[]; next_cursor: string | null }>({
  max: 100,
  ttl: 2_000,
});

export async function listConversations(
  filters: ConversationListFilters,
): Promise<{ items: ConversationSummary[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  const cacheKey = JSON.stringify({
    status: filters.status,
    takeover: filters.takeover,
    search: filters.search ?? null,
    cursor: filters.cursor ?? null,
    limit,
  });
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  const rows = await query<DbSummaryRow>(
    `SELECT client_phone, msg_count, last_msg_at, first_msg_at,
            last_agent, is_active_4h, had_takeover
       FROM v_admin_conversations_summary
      WHERE ($1::text = 'all' OR
             ($1 = 'active' AND is_active_4h) OR
             ($1 = 'inactive' AND NOT is_active_4h))
        AND ($2::text = 'all' OR
             ($2 = 'yes' AND had_takeover) OR
             ($2 = 'no' AND NOT had_takeover))
        AND ($3::text IS NULL OR client_phone LIKE '%' || $3 || '%')
        AND ($4::timestamptz IS NULL OR last_msg_at < $4)
      ORDER BY last_msg_at DESC
      LIMIT $5`,
    [
      filters.status,
      filters.takeover,
      filters.search ?? null,
      filters.cursor ?? null,
      limit,
    ],
  );

  const items: ConversationSummary[] = rows.map((r) => ({
    client_phone: r.client_phone,
    msg_count: typeof r.msg_count === "string" ? parseInt(r.msg_count, 10) : r.msg_count,
    last_msg_at: r.last_msg_at.toISOString(),
    first_msg_at: r.first_msg_at.toISOString(),
    last_agent: r.last_agent,
    is_active_4h: r.is_active_4h,
    had_takeover: r.had_takeover,
  }));

  const next_cursor = items.length === limit ? items[items.length - 1]!.last_msg_at : null;
  const result = { items, next_cursor };
  summaryCache.set(cacheKey, result);
  return result;
}

// ─── Timeline (drill-down de uma conversa) ────────────────────────────────

export interface ConversationMessage {
  id: number;
  role: string;
  content: string;
  intent: string | null;
  agent: string | null;
  trace_id: string | null;
  created_at: string; // ISO
}

export interface ConversationTimelineFilters {
  phone: string;
  before?: string | null; // ISO; mensagens com created_at < before
  limit?: number;
}

interface DbMessageRow {
  id: number;
  role: string;
  content: string;
  intent: string | null;
  agent: string | null;
  trace_id: string | null;
  created_at: Date;
}

export async function getConversationTimeline(
  filters: ConversationTimelineFilters,
): Promise<{ messages: ConversationMessage[]; has_more: boolean; next_before: string | null }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  const rows = await query<DbMessageRow>(
    `SELECT id, role, content, intent, agent, trace_id, created_at
       FROM conversation_history
      WHERE client_phone = $1
        AND ($2::timestamptz IS NULL OR created_at < $2)
      ORDER BY created_at DESC
      LIMIT $3`,
    [filters.phone, filters.before ?? null, limit],
  );

  const messages: ConversationMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    intent: r.intent,
    agent: r.agent,
    trace_id: r.trace_id,
    created_at: r.created_at.toISOString(),
  }));

  const has_more = messages.length === limit;
  const next_before = has_more ? messages[messages.length - 1]!.created_at : null;
  return { messages, has_more, next_before };
}

/** Para testes — limpa o cache LRU. */
export function clearConversationCache(): void {
  summaryCache.clear();
}
