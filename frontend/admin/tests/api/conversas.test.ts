/**
 * Integration tests — /api/conversas helpers + route handler validation.
 *
 * Covers AC1 (partially), AC2, AC3, AC4, AC5 from Story 1.2-DATA.
 *
 * AC1 (proxy-level auth): the handler itself does not enforce auth — `proxy.ts`
 *   (Next 16 middleware) redirects unauthenticated requests to /login (307).
 *   That gate is verified by Postman + prod smoke (memory: "AC1 validado em prod").
 *   We do not unit-test the proxy here (requires booting Next).
 *
 * Pre-req: `docker compose --profile test up -d postgres-test`
 * Run:     `TEST_DATABASE_URL=... npm test` (see tests/api/README.md)
 */

import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import {
  clearConversationCache,
  getConversationTimeline,
  listConversations,
} from "../../lib/conversas";
import { dbTest, insertMessage, isDbAvailable, resetDb } from "./helpers";
import { NextRequest } from "next/server";
import { GET as conversasGET } from "../../app/api/conversas/route";

before(async () => {
  if (await isDbAvailable()) await resetDb();
});

beforeEach(() => {
  // LRU cache TTL is 2s but resetDb between tests must not leak cached results.
  clearConversationCache();
});

// ─── AC2: GET /api/conversas?status=all com DB vazio → items=[], next_cursor=null
dbTest("AC2: lista vazia → items=[] next_cursor=null", async () => {
  await resetDb();
  const result = await listConversations({
    status: "all",
    takeover: "all",
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.next_cursor, null);
});

// ─── AC3: GET ?status=active → só items is_active_4h=true
dbTest("AC3: filter status=active retorna apenas is_active_4h=true", async () => {
  await resetDb();
  const now = Date.now();
  // active (mensagem user nas últimas 4h)
  await insertMessage({
    phone: "5511900000001",
    role: "user",
    createdAt: new Date(now - 30 * 60_000), // 30min atrás
  });
  // inactive (mensagem user 5h atrás)
  await insertMessage({
    phone: "5511900000002",
    role: "user",
    createdAt: new Date(now - 5 * 60 * 60_000),
  });
  clearConversationCache();

  const active = await listConversations({ status: "active", takeover: "all" });
  assert.equal(active.items.length, 1);
  assert.equal(active.items[0]!.client_phone, "5511900000001");
  assert.equal(active.items[0]!.is_active_4h, true);

  clearConversationCache();
  const inactive = await listConversations({ status: "inactive", takeover: "all" });
  assert.equal(inactive.items.length, 1);
  assert.equal(inactive.items[0]!.client_phone, "5511900000002");
  assert.equal(inactive.items[0]!.is_active_4h, false);

  clearConversationCache();
  const all = await listConversations({ status: "all", takeover: "all" });
  assert.equal(all.items.length, 2);
});

// ─── AC4: paginação por cursor → 2 requests sequenciais sem duplicatas
dbTest("AC4: paginação por cursor sem duplicatas", async () => {
  await resetDb();
  // Insere 5 phones distintos com timestamps decrescentes (1ms apart).
  const base = Date.now() - 60 * 60_000; // 1h atrás
  for (let i = 0; i < 5; i++) {
    await insertMessage({
      phone: `551190000010${i}`,
      role: "user",
      createdAt: new Date(base + i * 1000),
    });
  }
  clearConversationCache();

  // Página 1: limit=2 → últimos 2 mais recentes
  const page1 = await listConversations({ status: "all", takeover: "all", limit: 2 });
  assert.equal(page1.items.length, 2);
  assert.ok(page1.next_cursor, "next_cursor must be set when items === limit");

  clearConversationCache();
  // Página 2: usa cursor da página 1
  const page2 = await listConversations({
    status: "all",
    takeover: "all",
    limit: 2,
    cursor: page1.next_cursor,
  });
  assert.equal(page2.items.length, 2);

  // Zero duplicatas entre páginas
  const phones1 = new Set(page1.items.map((i) => i.client_phone));
  const phones2 = new Set(page2.items.map((i) => i.client_phone));
  for (const phone of phones2) {
    assert.ok(!phones1.has(phone), `phone ${phone} duplicado entre páginas`);
  }

  clearConversationCache();
  // Página 3: cursor da página 2 → 1 item restante
  const page3 = await listConversations({
    status: "all",
    takeover: "all",
    limit: 2,
    cursor: page2.next_cursor,
  });
  assert.equal(page3.items.length, 1);
  assert.equal(page3.next_cursor, null);
});

// ─── AC5: GET /api/conversas/{phone} com phone inexistente → messages=[]
dbTest("AC5: timeline de phone inexistente → messages=[] has_more=false", async () => {
  await resetDb();
  const result = await getConversationTimeline({ phone: "999999999999" });
  assert.deepEqual(result.messages, []);
  assert.equal(result.has_more, false);
  assert.equal(result.next_before, null);
});

// ─── AC5 bonus: drill-down retorna mensagens ordenadas DESC
dbTest("AC5+: drill-down ordena DESC por created_at", async () => {
  await resetDb();
  const phone = "5511911111111";
  await insertMessage({ phone, role: "user", content: "msg1", createdAt: new Date(Date.now() - 3000) });
  await insertMessage({ phone, role: "assistant", content: "msg2", createdAt: new Date(Date.now() - 2000) });
  await insertMessage({ phone, role: "user", content: "msg3", createdAt: new Date(Date.now() - 1000) });

  const result = await getConversationTimeline({ phone });
  assert.equal(result.messages.length, 3);
  // Mais recente primeiro (DESC)
  assert.equal(result.messages[0]!.content, "msg3");
  assert.equal(result.messages[2]!.content, "msg1");
});

// ─── Route handler validation (Zod) — sem DB necessária mas roda no mesmo suite.
test("Handler: GET /api/conversas com status inválido → 400", async () => {
  // O handler valida Zod antes de tocar o DB — não requer postgres.
  const req = new NextRequest("http://localhost/api/conversas?status=invalido");
  const res = await conversasGET(req);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "validation");
});

test("Handler: GET /api/conversas com limit acima de 100 → 400", async () => {
  const req = new NextRequest("http://localhost/api/conversas?limit=500");
  const res = await conversasGET(req);
  assert.equal(res.status, 400);
});

test("Handler: GET /api/conversas sem params → 200 com defaults aplicados", async () => {
  if (!(await isDbAvailable())) {
    // Pula se DB não disponível (defaults exigem query no DB).
    return;
  }
  await resetDb();
  const req = new NextRequest("http://localhost/api/conversas");
  const res = await conversasGET(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items), "items must be array");
  assert.equal(body.next_cursor, null);
});
