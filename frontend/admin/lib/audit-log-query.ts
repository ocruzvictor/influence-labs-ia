/**
 * Zod schema compartilhado entre `/api/audit-log` (GET) e
 * `/api/audit-log/export` (CSV).
 *
 * Story 1.7 — extração do schema previamente embutido em
 * `app/api/audit-log/route.ts` pra evitar drift entre os dois endpoints.
 */

import { z } from "zod";

export const auditLogQuerySchema = z.object({
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

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
