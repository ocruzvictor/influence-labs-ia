"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveWriteRoot, DEFAULT_THIS_REPO } = require("./resolve-write-root");

test("destination wins over env and default", () => {
  const result = resolveWriteRoot({
    destination: "/tmp/scripts",
    env: "/ignored",
    repoDefault: "../victor-libs/",
  });
  assert.deepEqual(result, {
    root: "/tmp/scripts",
    source: "destination",
    mustAsk: false,
  });
});

test("env wins when destination is empty", () => {
  const result = resolveWriteRoot({
    destination: "  ",
    env: "/proj/scripts",
  });
  assert.deepEqual(result, {
    root: "/proj/scripts",
    source: "env",
    mustAsk: false,
  });
});

test("this repo uses default when nothing is set", () => {
  const result = resolveWriteRoot({ env: "" });
  assert.deepEqual(result, {
    root: DEFAULT_THIS_REPO,
    source: "default",
    mustAsk: false,
  });
});

test("foreign repo without override must ask", () => {
  const result = resolveWriteRoot({ env: "", foreign: true });
  assert.deepEqual(result, {
    root: null,
    source: "unset",
    mustAsk: true,
  });
});
