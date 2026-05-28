/**
 * Tests para lib/kb-types.ts — pure helpers (slugify, diffSummary, formatMemoryForTess).
 *
 * Não cobrem funções de DB nem TESS — esses ficam pra integration tests fora deste arquivo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  diffSummary,
  formatMemoryForTess,
  KB_CATEGORIES,
} from "../lib/kb-types";

test("slugify — texto comum vira kebab-case", () => {
  assert.equal(slugify("FAQ Geral"), "faq-geral");
  assert.equal(slugify("Promoção Junho"), "promocao-junho");
  assert.equal(slugify("Fichas Técnicas — Serviços"), "fichas-tecnicas-servicos");
});

test("slugify — strip diacritics", () => {
  assert.equal(slugify("Endereço & Horário"), "endereco-horario");
  assert.equal(slugify("São Caetano"), "sao-caetano");
});

test("slugify — remove leading/trailing hyphens", () => {
  assert.equal(slugify("--foo-bar--"), "foo-bar");
  assert.equal(slugify("  espacos  "), "espacos");
});

test("slugify — apenas separadores vira string vazia", () => {
  assert.equal(slugify("---"), "");
  assert.equal(slugify("   "), "");
});

test("slugify — trunca em 100 chars", () => {
  const long = "a".repeat(150);
  assert.equal(slugify(long).length, 100);
});

test("diffSummary — mesmo conteúdo", () => {
  assert.equal(diffSummary("abc", "abc"), "sem mudança no tamanho");
});

test("diffSummary — addition", () => {
  const s = diffSummary("abc", "abcdef");
  assert.match(s, /^\+3 chars \(3→6\)$/);
});

test("diffSummary — removal", () => {
  const s = diffSummary("abcdef", "abc");
  assert.match(s, /^−3 chars \(6→3\)$/);
});

test("diffSummary — 1 char (singular)", () => {
  assert.match(diffSummary("a", "ab"), /^\+1 char \(1→2\)$/);
});

test("formatMemoryForTess — incluí título + categoria + conteúdo", () => {
  const out = formatMemoryForTess({
    title: "FAQ Geral",
    category: "faq",
    content_md: "Q: Vocês abrem feriado?\nA: Apenas em datas específicas.",
  });
  assert.match(out, /^# FAQ Geral\n\n_Categoria: faq_\n\n/);
  assert.match(out, /Vocês abrem feriado/);
});

test("KB_CATEGORIES — 5 valores fixos", () => {
  assert.deepEqual([...KB_CATEGORIES], ["faq", "servicos", "regras", "padroes", "info"]);
});
