/**
 * Tests para lib/format/phone.ts — formatPhone, digitsOnly, isValidPhone.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhone, digitsOnly, isValidPhone } from "../lib/format/phone";

test("formatPhone — celular BR 13 dígitos", () => {
  assert.equal(formatPhone("5511964540007"), "+55 (11) 96454-0007");
});

test("formatPhone — fixo BR 12 dígitos", () => {
  assert.equal(formatPhone("551134567890"), "+55 (11) 3456-7890");
});

test("formatPhone — string vazia ou null retorna em-dash", () => {
  assert.equal(formatPhone(""), "—");
  assert.equal(formatPhone(null), "—");
  assert.equal(formatPhone(undefined), "—");
});

test("formatPhone — input não-numérico retorna string crua", () => {
  assert.equal(formatPhone("abc123"), "abc123");
  assert.equal(formatPhone("+55 11 99999-9999"), "+55 11 99999-9999"); // já tinha formato
});

test("formatPhone — comprimento fora de 10-15 dígitos retorna crua", () => {
  assert.equal(formatPhone("123"), "123"); // muito curto
  assert.equal(formatPhone("1234567890123456"), "1234567890123456"); // muito longo
});

test("formatPhone — DDI não-BR degrada para +<digits>", () => {
  assert.equal(formatPhone("12025550100"), "+12025550100"); // US 11d
  assert.equal(formatPhone("447911123456"), "+447911123456"); // UK 12d (não-55)
});

test("digitsOnly — strip todos os não-numéricos", () => {
  assert.equal(digitsOnly("+55 (11) 99999-9999"), "5511999999999");
  assert.equal(digitsOnly("abc"), "");
  assert.equal(digitsOnly("123abc456"), "123456");
});

test("isValidPhone — match exato com /^\\d{10,15}$/", () => {
  assert.equal(isValidPhone("5511964540007"), true);
  assert.equal(isValidPhone("123456789"), false); // 9 dígitos
  assert.equal(isValidPhone("1234567890123456"), false); // 16 dígitos
  assert.equal(isValidPhone("55a64540007"), false); // não-numérico
  assert.equal(isValidPhone(""), false);
});
