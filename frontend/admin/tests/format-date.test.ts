/**
 * Tests para lib/format/date.ts — formatRelative, formatAbsolute.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelative, formatAbsolute } from "../lib/format/date";

test("formatRelative — Date objeto recente retorna pt-BR com sufixo", () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const out = formatRelative(fiveMinAgo);
  // "há cerca de 5 minutos" / "há 5 minutos" / variantes do date-fns
  assert.match(out, /há.*minut/i);
});

test("formatRelative — ISO string aceita", () => {
  const iso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const out = formatRelative(iso);
  assert.match(out, /há.*hora/i);
});

test("formatRelative — null/undefined retorna em-dash", () => {
  assert.equal(formatRelative(null), "—");
  assert.equal(formatRelative(undefined), "—");
  assert.equal(formatRelative(""), "—");
});

test("formatRelative — ISO inválida retorna em-dash", () => {
  assert.equal(formatRelative("not-a-date"), "—");
});

test("formatAbsolute — pattern default dd/MM/yyyy HH:mm", () => {
  const d = new Date("2026-05-27T14:32:00Z");
  const out = formatAbsolute(d);
  // Depende do timezone local — testa só estrutura genérica
  assert.match(out, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});

test("formatAbsolute — null/undefined retorna em-dash", () => {
  assert.equal(formatAbsolute(null), "—");
  assert.equal(formatAbsolute(undefined), "—");
});

test("formatAbsolute — pattern customizado é respeitado", () => {
  const d = new Date("2026-05-27T14:32:00Z");
  const out = formatAbsolute(d, "yyyy-MM-dd");
  assert.match(out, /^\d{4}-\d{2}-\d{2}$/);
});
