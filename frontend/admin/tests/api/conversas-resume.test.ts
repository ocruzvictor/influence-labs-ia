/**
 * BFF tests — POST /api/conversas/[phone]/resume
 *
 * Covers AC1, AC2, AC7: auth 401, Zod phone/note, X-Admin-Token proxy, status passthrough.
 */

import assert from "node:assert/strict";
import { mock, test, beforeEach, before, after } from "node:test";
import { NextRequest } from "next/server";
import { z } from "zod";

const TEST_TOKEN = "b".repeat(32);
const BACKEND_URL = "http://backend.test";

// Inline schemas (espelham route — evita import antes dos mocks)
const phoneSchema = z.string().regex(/^\d{10,15}$/);
const resumeBodySchema = z.object({
  note: z.string().trim().min(20).max(500),
});

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
};

let currentUser: CurrentUser | null = null;
let fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
let fetchResponse: Response = new Response(JSON.stringify({ status: "sent" }), { status: 200 });

const originalFetch = globalThis.fetch;

mock.module("@/lib/session", {
  namedExports: {
    getCurrentUser: async () => currentUser,
  },
});

mock.module("@/lib/env", {
  namedExports: {
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      ADMIN_JWT_SECRET: "a".repeat(64),
      RESEND_API_KEY: "re_test_value_for_unit_tests",
      RESEND_FROM_EMAIL: "auth-test@example.com",
      ADMIN_PUBLIC_URL: "http://localhost:3002",
      BACKEND_INTERNAL_URL: BACKEND_URL,
      BACKEND_INTERNAL_TOKEN: TEST_TOKEN,
      NODE_ENV: "test",
    },
    isProd: false,
  },
});

beforeEach(() => {
  currentUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@test.com",
    name: "Test Admin",
    role: "admin",
  };
  fetchCalls = [];
  fetchResponse = new Response(JSON.stringify({ status: "sent" }), { status: 200 });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({
      url: typeof input === "string" ? input : input.toString(),
      init,
    });
    return fetchResponse;
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

let POST: (
  req: NextRequest,
  ctx: { params: Promise<{ phone: string }> },
) => Promise<Response>;

before(async () => {
  const mod = await import("../../app/api/conversas/[phone]/resume/route");
  POST = mod.POST;
});

function makeRequest(phone: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/conversas/${phone}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx(phone: string): { params: Promise<{ phone: string }> } {
  return { params: Promise.resolve({ phone }) };
}

const VALID_NOTE =
  "Retoma o agendamento e confirma data e horario do teste de mecha com a cliente.";

// ─── Schema validation (mirrors route Zod)
test("phoneSchema: rejeita phones malformados", () => {
  assert.equal(phoneSchema.safeParse("123456789").success, false);
  assert.equal(phoneSchema.safeParse("1234567890123456").success, false);
  assert.equal(phoneSchema.safeParse("+5511964540007").success, false);
  assert.equal(phoneSchema.safeParse("5511964540007").success, true);
});

test("resumeBodySchema: nota 20–500 chars após trim", () => {
  assert.equal(resumeBodySchema.safeParse({ note: "a".repeat(19) }).success, false);
  assert.equal(resumeBodySchema.safeParse({ note: "a".repeat(20) }).success, true);
  assert.equal(resumeBodySchema.safeParse({ note: "a".repeat(501) }).success, false);
  assert.equal(resumeBodySchema.safeParse({ note: `  ${"b".repeat(20)}  ` }).success, true);
});

// ─── Handler: 401 sem sessão
test("Handler: sem getCurrentUser → 401", async () => {
  currentUser = null;
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 401);
  assert.equal(fetchCalls.length, 0);
});

// ─── Handler: validação phone
test("Handler: phone inválido → 400", async () => {
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("abc"));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_phone_format");
});

// ─── Handler: validação nota
test("Handler: nota curta → 400", async () => {
  const res = await POST(makeRequest("5511964540007", { note: "curta" }), makeCtx("5511964540007"));
  assert.equal(res.status, 400);
  assert.equal(fetchCalls.length, 0);
});

// ─── Handler: proxy upstream com X-Admin-Token + actor admin
test("Handler: encaminha POST upstream com X-Admin-Token e actor admin", async () => {
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 200);
  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0]!.url,
    `${BACKEND_URL}/admin/conversations/5511964540007/resume`,
  );
  const headers = new Headers(fetchCalls[0]!.init?.headers);
  assert.equal(headers.get("X-Admin-Token"), TEST_TOKEN);
  assert.equal(headers.get("Authorization"), null, "não usa Bearer no resume BFF");
  const upstreamBody = JSON.parse(String(fetchCalls[0]!.init?.body));
  assert.equal(upstreamBody.actor, "admin");
  assert.equal(upstreamBody.note, VALID_NOTE);
  const body = await res.json();
  assert.equal(body.status, "sent");
});

// ─── Handler: mapeamento status upstream
test("Handler: repassa 409 human_only do upstream", async () => {
  fetchResponse = new Response(JSON.stringify({ error: "human_only" }), { status: 409 });
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "human_only");
});

test("Handler: repassa 200 window_closed do upstream", async () => {
  fetchResponse = new Response(JSON.stringify({ status: "window_closed" }), { status: 200 });
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "window_closed");
});

test("Handler: repassa 503 kapso_send_failed do upstream", async () => {
  fetchResponse = new Response(JSON.stringify({ error: "kapso_send_failed" }), { status: 503 });
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, "kapso_send_failed");
});

test("Handler: fetch failure → 503 upstream_unreachable", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  const res = await POST(makeRequest("5511964540007", { note: VALID_NOTE }), makeCtx("5511964540007"));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, "upstream_unreachable");
});
