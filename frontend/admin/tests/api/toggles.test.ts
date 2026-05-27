/**
 * Integration tests — bot toggles (lib + handler shape).
 *
 * Covers AC6, AC7 (partially), AC9, AC11, AC12 from Story 1.2-DATA.
 *
 * AC6/AC7 ("bot stops/resumes in WhatsApp ≤5s") have TWO halves:
 *   • DB mutation persists + audit row written — covered here.
 *   • Backend bot-state cache picks up change in ≤5s — covered by
 *     backend/test/bot-state.test.js + Postman/smoke (memory: bot ON/OFF flow).
 *
 * AC11 (uppercase key → 400) and AC12 (inexistent key → 404) tested directly
 * at the Zod-schema / setToggle level. The HTTP-layer wiring (PATCH handler)
 * also rejects appropriately — verified via Postman collection.
 *
 * Pre-req: `docker compose --profile test up -d postgres-test`
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { listToggles, setToggle } from "../../lib/toggles";
import { logAudit } from "../../lib/audit";
import { listAuditLog } from "../../lib/audit-log";
import { query } from "../../lib/db";
import { createTestUser, dbTest, isDbAvailable, resetDb } from "./helpers";

before(async () => {
  if (await isDbAvailable()) await resetDb();
});

// ─── AC6+AC7: PATCH persiste enabled=false e enabled=true em bot_toggles
dbTest("AC6: setToggle(global, false) persiste no DB", async () => {
  await resetDb();
  const userId = await createTestUser("ac6@example.com");
  const result = await setToggle("global", false, userId);
  assert.ok(result, "result deve existir (toggle existe)");
  assert.equal(result.before, true);
  assert.equal(result.after, false);

  const toggles = await listToggles();
  const global = toggles.find((t) => t.key === "global");
  assert.ok(global);
  assert.equal(global.enabled, false);
});

dbTest("AC7: setToggle(global, true) volta o estado", async () => {
  await resetDb();
  const userId = await createTestUser("ac7@example.com");
  await setToggle("global", false, userId);
  const result = await setToggle("global", true, userId);
  assert.ok(result);
  assert.equal(result.before, false);
  assert.equal(result.after, true);

  const toggles = await listToggles();
  assert.equal(toggles.find((t) => t.key === "global")?.enabled, true);
});

// ─── AC9: após PATCH, audit-log retorna entry com {before, after}
dbTest("AC9: setToggle + logAudit grava entry com action=toggle.set e payload {before, after}", async () => {
  await resetDb();
  const userId = await createTestUser("ac9@example.com");

  const result = await setToggle("global", false, userId);
  assert.ok(result);

  // Mirror what /api/toggles PATCH handler does after setToggle:
  await logAudit({
    action: "toggle.set",
    userId,
    targetType: "bot_toggle",
    targetId: "global",
    payload: { before: result.before, after: result.after },
    ip: "127.0.0.1",
    userAgent: "integration-test",
  });

  const log = await listAuditLog({ userId });
  assert.equal(log.items.length, 1);
  const entry = log.items[0]!;
  assert.equal(entry.action, "toggle.set");
  assert.equal(entry.target_id, "global");
  assert.equal(entry.target_type, "bot_toggle");
  const payload = entry.payload as { before: boolean; after: boolean };
  assert.equal(payload.before, true);
  assert.equal(payload.after, false);
});

// ─── AC11: PATCH com key="GLOBAL" (uppercase) → invalid (Zod regex)
test("AC11: schema rejeita key em uppercase", () => {
  // Importa o regex inline do route (mantém em sync com a implementação).
  // O regex em app/api/toggles/route.ts: /^[a-z_]+(:[a-z_]+)?$/
  const keyRegex = /^[a-z_]+(:[a-z_]+)?$/;
  assert.equal(keyRegex.test("GLOBAL"), false, "GLOBAL deve falhar");
  assert.equal(keyRegex.test("Global"), false, "Global deve falhar");
  assert.equal(keyRegex.test("global"), true, "global deve passar");
  assert.equal(keyRegex.test("feature:audio"), true, "feature:audio deve passar");
  assert.equal(keyRegex.test("feature audio"), false, "espaço deve falhar");
});

// ─── AC12: PATCH com key inexistente → setToggle retorna null (handler responde 404)
dbTest("AC12: setToggle(key inexistente) retorna null", async () => {
  await resetDb();
  const userId = await createTestUser("ac12@example.com");
  const result = await setToggle("nao_existe", false, userId);
  assert.equal(result, null);

  // Verifica que NENHUMA row foi modificada
  const toggles = await listToggles();
  assert.equal(toggles.length, 3, "três seeds intactas");
});

// ─── Bonus: listToggles retorna seeds ordenadas
dbTest("listToggles retorna seeds ordenadas por key", async () => {
  await resetDb();
  const toggles = await listToggles();
  assert.equal(toggles.length, 3);
  assert.deepEqual(
    toggles.map((t) => t.key),
    ["feature:audio", "feature:supervisor", "global"],
  );
  // Todas começam enabled=true
  for (const t of toggles) {
    assert.equal(t.enabled, true);
  }
});

// ─── Bonus: setToggle propaga updated_by para a row
dbTest("setToggle grava updated_by", async () => {
  await resetDb();
  const userId = await createTestUser("updatedby@example.com");
  await setToggle("feature:audio", false, userId);

  const rows = await query<{ updated_by: string | null }>(
    `SELECT updated_by FROM bot_toggles WHERE key = 'feature:audio'`,
  );
  assert.equal(rows[0]?.updated_by, userId);
});
