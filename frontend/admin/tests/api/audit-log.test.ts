/**
 * Integration tests — admin audit log (lib + filters).
 *
 * Covers AC10 + filtros (action, target_type, since, cursor pagination).
 *
 * Pre-req: `docker compose --profile test up -d postgres-test`
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { logAudit } from "../../lib/audit";
import { listAuditLog } from "../../lib/audit-log";
import { createTestUser, dbTest, isDbAvailable, resetDb } from "./helpers";

before(async () => {
  if (await isDbAvailable()) await resetDb();
});

// ─── AC10: filtro user_id retorna SOMENTE entries daquele user
dbTest("AC10: filtro user_id isola entries por usuário", async () => {
  await resetDb();
  const userA = await createTestUser("user-a@example.com");
  const userB = await createTestUser("user-b@example.com");

  await logAudit({ action: "toggle.set", userId: userA, payload: { x: 1 } });
  await logAudit({ action: "whitelist.upsert", userId: userA, payload: { y: 2 } });
  await logAudit({ action: "toggle.set", userId: userB, payload: { z: 3 } });

  const logA = await listAuditLog({ userId: userA });
  assert.equal(logA.items.length, 2);
  for (const item of logA.items) {
    assert.equal(item.user_email, "user-a@example.com");
  }

  const logB = await listAuditLog({ userId: userB });
  assert.equal(logB.items.length, 1);
  assert.equal(logB.items[0]?.user_email, "user-b@example.com");
});

// ─── Filtro action exato
dbTest("filtro action retorna apenas action exato", async () => {
  await resetDb();
  const userId = await createTestUser("filter-action@example.com");
  await logAudit({ action: "toggle.set", userId });
  await logAudit({ action: "whitelist.upsert", userId });
  await logAudit({ action: "whitelist.remove", userId });

  const toggleOnly = await listAuditLog({ action: "toggle.set" });
  assert.equal(toggleOnly.items.length, 1);
  assert.equal(toggleOnly.items[0]?.action, "toggle.set");
});

// ─── Filtro action com wildcard (prefix)
dbTest("filtro action com wildcard 'whitelist.*' captura subset", async () => {
  await resetDb();
  const userId = await createTestUser("filter-wildcard@example.com");
  await logAudit({ action: "toggle.set", userId });
  await logAudit({ action: "whitelist.upsert", userId });
  await logAudit({ action: "whitelist.remove", userId });

  const whitelistAll = await listAuditLog({ action: "whitelist.*" });
  assert.equal(whitelistAll.items.length, 2);
  for (const item of whitelistAll.items) {
    assert.ok(item.action.startsWith("whitelist."));
  }
});

// ─── Filtro target_type
dbTest("filtro target_type isola por tipo de alvo", async () => {
  await resetDb();
  const userId = await createTestUser("filter-target@example.com");
  await logAudit({ action: "toggle.set", userId, targetType: "bot_toggle", targetId: "global" });
  await logAudit({ action: "whitelist.upsert", userId, targetType: "bot_whitelist", targetId: "5511" });

  const only = await listAuditLog({ targetType: "bot_toggle" });
  assert.equal(only.items.length, 1);
  assert.equal(only.items[0]?.target_type, "bot_toggle");
});

// ─── Cursor pagination retorna sem duplicatas
dbTest("paginação por cursor (BIGINT id) zero duplicatas", async () => {
  await resetDb();
  const userId = await createTestUser("pagi@example.com");
  for (let i = 0; i < 5; i++) {
    await logAudit({ action: `test.${i}`, userId });
  }

  const page1 = await listAuditLog({ userId, limit: 2 });
  assert.equal(page1.items.length, 2);
  assert.ok(page1.next_cursor);

  const page2 = await listAuditLog({ userId, limit: 2, cursor: page1.next_cursor });
  assert.equal(page2.items.length, 2);

  const ids1 = new Set(page1.items.map((i) => i.id));
  const ids2 = new Set(page2.items.map((i) => i.id));
  for (const id of ids2) {
    assert.ok(!ids1.has(id), `id ${id} duplicado entre páginas`);
  }

  const page3 = await listAuditLog({ userId, limit: 2, cursor: page2.next_cursor });
  assert.equal(page3.items.length, 1);
  assert.equal(page3.next_cursor, null);
});

// ─── since/until time range
dbTest("filtro since exclui entries anteriores ao timestamp", async () => {
  await resetDb();
  const userId = await createTestUser("since@example.com");
  await logAudit({ action: "old", userId });
  // Pequeno gap para garantir created_at diferente
  await new Promise((r) => setTimeout(r, 10));
  const cutoff = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 10));
  await logAudit({ action: "new", userId });

  const recent = await listAuditLog({ userId, since: cutoff });
  assert.equal(recent.items.length, 1);
  assert.equal(recent.items[0]?.action, "new");
});

// ─── logAudit é fail-silent quando user_id é null (não-FK)
test("logAudit aceita userId=null", async () => {
  if (!(await isDbAvailable())) return;
  await resetDb();
  await logAudit({ action: "system.boot", userId: null });
  const log = await listAuditLog({ action: "system.boot" });
  assert.equal(log.items.length, 1);
  assert.equal(log.items[0]?.user_email, null);
});
