/**
 * Tests para lib/health-status.ts (deriveCardStatus + helpers internos) e
 * app/api/audit-log/export (toCsvField + EXPORT_LIMIT) e Zod schema do export.
 *
 * Story 1.7 AC57 + AC60.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveCardStatus,
  __internal,
  type HealthPayload,
} from "../lib/health-status";
import { auditLogQuerySchema } from "../lib/audit-log-query";
import { __test as exportInternals } from "../app/api/audit-log/export/route";

const {
  uptimeLabel,
  whatsAppHoursRemaining,
  mapWaStatus,
  mapTrinksStatus,
  deriveTrinksStatus,
  mapPgStatus,
  safeHostname,
  safeIsoMinute,
} = __internal;

// =============================================================================
// deriveCardStatus
// =============================================================================

test("deriveCardStatus — backend_unreachable retorna 4 cards down", () => {
  const cards = deriveCardStatus({ backend_unreachable: true } as HealthPayload);
  assert.equal(cards.length, 4);
  for (const c of cards) {
    assert.equal(c.status, "down");
    assert.equal(c.statusLabel, "Erro");
  }
  assert.deepEqual(
    cards.map((c) => c.title),
    ["WhatsApp", "TESS", "Trinks", "Postgres"],
  );
});

test("deriveCardStatus — TESS workspace_configured false vira warn", () => {
  const cards = deriveCardStatus({
    tess: {
      agent_id: "46589",
      url: "https://api.tess.im/agents/46589/execute",
      workspace_configured: false,
    },
    postgres: { pool: { total: 5, idle: 5, waiting: 0 }, uptime_seconds: 1 },
    trinks_ping: { status: "ok", latency_ms: 100, cached: false },
    whatsapp_window: { configured: true, status: "green", hours_since: 1 },
  });
  const tess = cards.find((c) => c.title === "TESS");
  assert.equal(tess?.status, "warn");
  assert.match(tess?.metrics[2]?.value ?? "", /header ausente/);
});

test("deriveCardStatus — payload OK total → todos ok", () => {
  const payload: HealthPayload = {
    tess: { agent_id: "33200", url: "https://api.tess.im/agents/33200/execute" },
    postgres: {
      pool: { total: 5, idle: 5, waiting: 0 },
      uptime_seconds: 3600,
      last_ok_query_at: new Date().toISOString(),
    },
    trinks_ping: { status: "ok", latency_ms: 300, cached: false },
    whatsapp_window: {
      configured: true,
      status: "green",
      hours_since: 2,
      last_inbound_at: "2026-05-28T12:00:00Z",
    },
  };
  const cards = deriveCardStatus(payload);
  assert.equal(cards.length, 4);
  for (const c of cards) assert.equal(c.status, "ok");
});

test("deriveCardStatus — Trinks slow vira warn", () => {
  const cards = deriveCardStatus({
    tess: { agent_id: "33200", url: "https://api.tess.im/agents/33200" },
    postgres: { pool: { total: 5, idle: 5, waiting: 0 }, uptime_seconds: 1 },
    trinks_ping: { status: "slow", latency_ms: 2200, cached: false },
    whatsapp_window: { configured: true, status: "green", hours_since: 1 },
  });
  const trinks = cards.find((c) => c.title === "Trinks");
  assert.ok(trinks);
  assert.equal(trinks.status, "warn");
});

test("deriveCardStatus — Trinks webhook ausente e orçamento restrito viram warn", () => {
  const payload: HealthPayload = {
    tess: { agent_id: "46589", url: "https://api.tess.im/agents/46589" },
    postgres: { pool: { total: 5, idle: 5, waiting: 0 }, uptime_seconds: 1 },
    trinks_ping: { status: "ok", latency_ms: 100, cached: false },
    trinks_usage: {
      mode: "restricted",
      effective_used: 7600,
      operational_cap: 8500,
      local_consumed: 120,
    },
    trinks_webhook: { configured: false, pending_notifications: 0 },
    whatsapp_window: { configured: true, status: "green", hours_since: 1 },
  };
  const trinks = deriveCardStatus(payload).find((c) => c.title === "Trinks");
  assert.equal(trinks?.status, "warn");
  assert.match(trinks?.metrics[0]?.value ?? "", /7600\/8500/);
});

test("deriveCardStatus — Postgres pool.waiting >= 5 vira down", () => {
  const cards = deriveCardStatus({
    tess: { agent_id: "33200", url: "https://x.y" },
    postgres: { pool: { total: 5, idle: 0, waiting: 7 }, uptime_seconds: 1 },
    trinks_ping: { status: "ok", latency_ms: 100, cached: false },
    whatsapp_window: { configured: true, status: "green", hours_since: 1 },
  });
  const pg = cards.find((c) => c.title === "Postgres");
  assert.ok(pg);
  assert.equal(pg.status, "down");
});

test("deriveCardStatus — postgres.pool=null vira down", () => {
  const cards = deriveCardStatus({
    tess: { agent_id: "33200", url: "https://x.y" },
    postgres: { pool: null, uptime_seconds: 1 },
    trinks_ping: { status: "ok", latency_ms: 100, cached: false },
    whatsapp_window: { configured: true, status: "green", hours_since: 1 },
  });
  const pg = cards.find((c) => c.title === "Postgres");
  assert.equal(pg?.status, "down");
});

test("deriveCardStatus — whatsapp não configurado vira down", () => {
  const cards = deriveCardStatus({
    tess: { agent_id: "33200", url: "https://x.y" },
    postgres: { pool: { total: 5, idle: 5, waiting: 0 }, uptime_seconds: 1 },
    trinks_ping: { status: "ok", latency_ms: 100, cached: false },
    whatsapp_window: { configured: false },
  });
  const wa = cards.find((c) => c.title === "WhatsApp");
  assert.equal(wa?.status, "down");
});

// =============================================================================
// Helpers internos
// =============================================================================

test("uptimeLabel — buckets", () => {
  assert.equal(uptimeLabel(30), "30s");
  assert.equal(uptimeLabel(125), "2min");
  assert.equal(uptimeLabel(7200), "2h");
  assert.equal(uptimeLabel(86400 * 3), "3d");
  assert.equal(uptimeLabel(null), "—");
  assert.equal(uptimeLabel(undefined), "—");
});

test("whatsAppHoursRemaining — restantes", () => {
  assert.equal(whatsAppHoursRemaining(2), "22.0h restantes");
  assert.equal(whatsAppHoursRemaining(null), "—");
  assert.equal(whatsAppHoursRemaining(24), "Fechada");
});

test("mapWaStatus — green/yellow/red", () => {
  assert.equal(mapWaStatus("green"), "ok");
  assert.equal(mapWaStatus("yellow"), "warn");
  assert.equal(mapWaStatus("red"), "down");
  assert.equal(mapWaStatus(undefined), "down");
});

test("mapTrinksStatus — ok/slow/down", () => {
  assert.equal(mapTrinksStatus("ok"), "ok");
  assert.equal(mapTrinksStatus("slow"), "warn");
  assert.equal(mapTrinksStatus("down"), "down");
});

test("deriveTrinksStatus — cap bloqueado ou erro de webhook vira down", () => {
  assert.equal(deriveTrinksStatus({
    trinks_ping: { status: "ok" },
    trinks_usage: { mode: "blocked" },
  }), "down");
  assert.equal(deriveTrinksStatus({
    trinks_ping: { status: "ok" },
    trinks_webhook: { configured: true, last_error: "falha" },
  }), "down");
});

test("safeHostname — URL válida retorna hostname", () => {
  assert.equal(
    safeHostname("https://api.tess.im/agents/33200/execute"),
    "api.tess.im",
  );
});

test("safeHostname — URL inválida não throw, retorna fallback", () => {
  assert.equal(safeHostname("not-a-url"), "URL inválida");
  assert.equal(safeHostname(""), "—");
  assert.equal(safeHostname(undefined), "—");
});

test("safeIsoMinute — ISO válida formatada YYYY-MM-DD HH:MM", () => {
  assert.equal(safeIsoMinute("2026-05-28T12:34:56Z"), "2026-05-28 12:34");
});

test("safeIsoMinute — ISO inválida não throw, retorna fallback", () => {
  assert.equal(safeIsoMinute("not-a-date"), "data inválida");
  assert.equal(safeIsoMinute(null), "—");
  assert.equal(safeIsoMinute(undefined), "—");
});

test("mapPgStatus — pool null vira down", () => {
  assert.equal(mapPgStatus({ pool: null }).status, "down");
  assert.equal(mapPgStatus(undefined).status, "down");
  assert.equal(
    mapPgStatus({ pool: { total: 5, idle: 5, waiting: 0 } }).status,
    "ok",
  );
  assert.equal(
    mapPgStatus({ pool: { total: 5, idle: 0, waiting: 3 } }).status,
    "warn",
  );
  assert.equal(
    mapPgStatus({ pool: { total: 5, idle: 0, waiting: 5 } }).status,
    "down",
  );
});

// =============================================================================
// CSV escape (RFC 4180)
// =============================================================================

test("toCsvField — string simples sem escape", () => {
  assert.equal(exportInternals.toCsvField("foo"), "foo");
  assert.equal(exportInternals.toCsvField(""), "");
});

test("toCsvField — null/undefined vira string vazia", () => {
  assert.equal(exportInternals.toCsvField(null), "");
  assert.equal(exportInternals.toCsvField(undefined), "");
});

test("toCsvField — vírgula força quote wrap", () => {
  assert.equal(exportInternals.toCsvField("foo, bar"), '"foo, bar"');
});

test("toCsvField — aspas escapadas como duplas", () => {
  assert.equal(
    exportInternals.toCsvField('texto com "aspas"'),
    '"texto com ""aspas"""',
  );
});

test("toCsvField — newline força quote wrap", () => {
  assert.equal(exportInternals.toCsvField("linha1\nlinha2"), '"linha1\nlinha2"');
  assert.equal(exportInternals.toCsvField("linha1\r\nlinha2"), '"linha1\r\nlinha2"');
});

test("toCsvField — payload JSON com aspas+vírgula+\\n", () => {
  const payload = { diff: 'antes:"foo"\nbar', count: 5 };
  const out = exportInternals.toCsvField(payload);
  // JSON.stringify produz {"diff":"antes:\"foo\"\nbar","count":5}
  // toCsvField precisa: (a) wrap em aspas (contém vírgula) (b) escapar aspas internas
  assert.ok(out.startsWith('"'), "deve começar com aspas (wrap)");
  assert.ok(out.endsWith('"'), "deve terminar com aspas (wrap)");
  // Aspas internas (literais ") viram duplas — sem `"foo"` adjacente porque
  // JSON escapa pra `\"foo\"`, então buscar a sequência `\""foo\""` no output.
  assert.ok(out.includes('\\""foo\\""'), "aspas internas devem virar duplas");
  // Não deve ter aspas isoladas no meio (todas pareadas)
  const innerContent = out.slice(1, -1);
  const isolatedQuotes = innerContent.replace(/""/g, "").includes('"');
  assert.equal(isolatedQuotes, false, "todas as aspas internas devem estar escapadas como duplas");
});

test("EXPORT_LIMIT é 5000", () => {
  assert.equal(exportInternals.EXPORT_LIMIT, 5000);
});

// =============================================================================
// Zod schema do export
// =============================================================================

test("auditLogQuerySchema — query válida", () => {
  const result = auditLogQuerySchema.safeParse({
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    action: "kb.update",
    since: "2026-05-01T00:00:00Z",
    limit: "50",
  });
  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.data.limit, 50);
    assert.equal(result.data.action, "kb.update");
  }
});

test("auditLogQuerySchema — action acima de 100 chars falha", () => {
  const result = auditLogQuerySchema.safeParse({
    action: "a".repeat(101),
  });
  assert.equal(result.success, false);
});

test("auditLogQuerySchema — since inválido falha", () => {
  const result = auditLogQuerySchema.safeParse({
    since: "not-a-date",
  });
  assert.equal(result.success, false);
});

test("auditLogQuerySchema — cursor não numérico falha", () => {
  const result = auditLogQuerySchema.safeParse({ cursor: "abc" });
  assert.equal(result.success, false);
});

test("auditLogQuerySchema — limit default = 100", () => {
  const result = auditLogQuerySchema.safeParse({});
  assert.ok(result.success);
  if (result.success) assert.equal(result.data.limit, 100);
});
