/**
 * Unit tests for lib/auth.ts — pure crypto / JWT helpers.
 *
 * Runs with: npm test
 *   → node --import tsx --import ./tests/setup.ts --test tests/*.test.ts
 *
 * tests/setup.ts preloads stub env vars so lib/env validation passes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";

test("hashToken: deterministic sha256 hex", () => {
  const a = auth.hashToken("hello-world");
  const b = auth.hashToken("hello-world");
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("hashToken: different inputs produce different outputs", () => {
  assert.notEqual(auth.hashToken("input-a"), auth.hashToken("input-b"));
});

test("generateMagicLinkToken: plaintext is url-safe, hash matches", () => {
  const { plaintext, hash } = auth.generateMagicLinkToken();
  assert.match(plaintext, /^[A-Za-z0-9_-]+$/);
  assert.ok(plaintext.length >= 40, `expected >=40 chars, got ${plaintext.length}`);
  assert.equal(hash, auth.hashToken(plaintext));
});

test("generateMagicLinkToken: produces unique values each call", () => {
  const a = auth.generateMagicLinkToken();
  const b = auth.generateMagicLinkToken();
  assert.notEqual(a.plaintext, b.plaintext);
  assert.notEqual(a.hash, b.hash);
});

test("signJWT/verifyJWT roundtrip: returns original sub + jti", async () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const jti = "22222222-2222-2222-2222-222222222222";
  const jwt = await auth.signJWT(userId, jti);
  assert.equal(typeof jwt, "string");
  assert.equal(jwt.split(".").length, 3);

  const payload = await auth.verifyJWT(jwt);
  assert.ok(payload !== null);
  assert.equal(payload.sub, userId);
  assert.equal(payload.jti, jti);
  assert.equal(typeof payload.exp, "number");
  assert.equal(typeof payload.iat, "number");
});

test("verifyJWT: tampered signature returns null", async () => {
  const jwt = await auth.signJWT("user-x", "jti-y");
  const parts = jwt.split(".");
  const sig = parts[2]!;
  parts[2] = sig.slice(0, -1) + (sig.slice(-1) === "a" ? "b" : "a");
  const payload = await auth.verifyJWT(parts.join("."));
  assert.equal(payload, null);
});

test("verifyJWT: garbage strings return null", async () => {
  assert.equal(await auth.verifyJWT("not-a-jwt"), null);
  assert.equal(await auth.verifyJWT(""), null);
  assert.equal(await auth.verifyJWT("a.b.c"), null);
});
