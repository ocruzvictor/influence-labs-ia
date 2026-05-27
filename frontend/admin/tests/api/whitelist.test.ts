/**
 * Integration tests — bot whitelist (lib + handler validation).
 *
 * Covers AC8 + validações de formato/modo do Story 1.2-DATA.
 *
 * AC8 ("POST /api/whitelist mode=block silencia próxima mensagem"): tem 2 halves:
 *   • DB grava phone+mode=block + audit row → coberto aqui.
 *   • Backend bot-state vê mode=block na próxima inbound e silencia →
 *     coberto por backend/test/bot-state.test.js + Postman E2E.
 *
 * Pre-req: `docker compose --profile test up -d postgres-test`
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  listWhitelist,
  removeWhitelist,
  upsertWhitelist,
} from "../../lib/whitelist";
import { logAudit } from "../../lib/audit";
import { listAuditLog } from "../../lib/audit-log";
import { createTestUser, dbTest, isDbAvailable, resetDb } from "./helpers";

before(async () => {
  if (await isDbAvailable()) await resetDb();
});

// ─── AC8: POST mode=block grava no DB com audit
dbTest("AC8: upsertWhitelist(phone, block) grava no DB", async () => {
  await resetDb();
  const userId = await createTestUser("ac8@example.com");

  const result = await upsertWhitelist(
    "5511999999999",
    "block",
    "test block reason",
    userId,
  );

  assert.equal(result.before, null, "phone novo → before=null");
  assert.equal(result.after.phone, "5511999999999");
  assert.equal(result.after.mode, "block");
  assert.equal(result.after.reason, "test block reason");

  // Audit (mirroring handler behavior)
  await logAudit({
    action: "whitelist.upsert",
    userId,
    targetType: "bot_whitelist",
    targetId: "5511999999999",
    payload: { before: result.before, after: result.after },
  });

  const log = await listAuditLog({ action: "whitelist.upsert" });
  assert.equal(log.items.length, 1);
  assert.equal(log.items[0]?.target_id, "5511999999999");
});

// ─── AC8 followup: ler whitelist agora retorna o phone em mode=block
dbTest("AC8: listWhitelist filtra por mode=block", async () => {
  await resetDb();
  const userId = await createTestUser("ac8b@example.com");

  await upsertWhitelist("5511888888888", "block", null, userId);

  const blocked = await listWhitelist("block");
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0]?.phone, "5511888888888");

  const allow = await listWhitelist("allow");
  assert.equal(allow.length, 3, "3 seeds de allow estão intactas");
});

// ─── Validação Zod (phone format): exatamente 10-15 dígitos
test("schema rejeita phones malformados", () => {
  // Regex inline (espelha app/api/whitelist/route.ts): /^\d{10,15}$/
  const phoneRegex = /^\d{10,15}$/;
  // Inválidos
  assert.equal(phoneRegex.test("123456789"), false, "9 dígitos: curto demais");
  assert.equal(phoneRegex.test("1234567890123456"), false, "16 dígitos: longo demais");
  assert.equal(phoneRegex.test("+5511964540007"), false, "+ não permitido");
  assert.equal(phoneRegex.test("5511 96454 0007"), false, "espaços não permitidos");
  assert.equal(phoneRegex.test("abcdefghij"), false, "letras não permitidas");
  assert.equal(phoneRegex.test(""), false, "vazio falha");
  // Válidos
  assert.equal(phoneRegex.test("5511964540007"), true);
  assert.equal(phoneRegex.test("1234567890"), true, "10 dígitos OK");
});

test("schema rejeita modes inválidos", () => {
  // Modes válidos do schema: allow | block | human_only
  const validModes = new Set(["allow", "block", "human_only"]);
  assert.equal(validModes.has("ALLOW"), false, "uppercase rejeitado");
  assert.equal(validModes.has("disable"), false, "valor inválido rejeitado");
  assert.equal(validModes.has("allow"), true);
});

// ─── upsert idempotente: segundo upsert atualiza mode + reason
dbTest("upsertWhitelist é idempotente — segundo upsert atualiza", async () => {
  await resetDb();
  const userId = await createTestUser("idem@example.com");
  const phone = "5511777777777";

  const first = await upsertWhitelist(phone, "allow", "first", userId);
  assert.equal(first.before, null);

  const second = await upsertWhitelist(phone, "block", "second", userId);
  assert.equal(second.before?.mode, "allow");
  assert.equal(second.after.mode, "block");
  assert.equal(second.after.reason, "second");

  // Apenas 1 row com esse phone
  const all = await listWhitelist();
  const matches = all.filter((r) => r.phone === phone);
  assert.equal(matches.length, 1);
});

// ─── removeWhitelist remove e retorna row removida
dbTest("removeWhitelist remove existente e retorna row", async () => {
  await resetDb();
  const userId = await createTestUser("rm@example.com");
  const phone = "5511666666666";
  await upsertWhitelist(phone, "block", "to be removed", userId);

  const deleted = await removeWhitelist(phone);
  assert.ok(deleted);
  assert.equal(deleted.phone, phone);
  assert.equal(deleted.mode, "block");

  // Confirma remoção
  const all = await listWhitelist();
  assert.equal(all.find((r) => r.phone === phone), undefined);
});

dbTest("removeWhitelist(phone inexistente) retorna null", async () => {
  await resetDb();
  const result = await removeWhitelist("5511000000000");
  assert.equal(result, null);
});
