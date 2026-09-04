/**
 * Contratos chão 6 — abort por perfil (SOT §6.1–6.2)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_ABORT_MS,
  TESS_TIMEOUT_WALL_MS,
  TESS_ABORT_HARD_CEILING_MS,
  parseAbortCaps,
  resolveTessAbortMs,
} = require('../lib/tess-timeout-budget');
const { PROFILES } = require('../lib/tess-context-profiles');

describe('6.1 tabela canónica', () => {
  const leanProfiles = [PROFILES.MIN, PROFILES.FAQ, PROFILES.PRICE, PROFILES.CANCEL];
  const heavyProfiles = [PROFILES.BOOKING, PROFILES.FULL];

  for (const profile of leanProfiles) {
    test(`${profile} → 13000`, () => {
      assert.equal(resolveTessAbortMs(profile), 13000);
      assert.ok(13000 < TESS_TIMEOUT_WALL_MS);
    });
  }

  for (const profile of heavyProfiles) {
    test(`${profile} → 22000 (≥ 12400)`, () => {
      assert.equal(resolveTessAbortMs(profile), 22000);
      assert.ok(22000 >= 12400);
      assert.ok(22000 < TESS_TIMEOUT_WALL_MS);
    });
  }

  test('undefined → FULL 22000', () => {
    assert.equal(resolveTessAbortMs(undefined), 22000);
  });

  test("'NOPE' → FULL 22000", () => {
    assert.equal(resolveTessAbortMs('NOPE'), 22000);
  });

  test('defaults frozen', () => {
    assert.deepEqual(DEFAULT_ABORT_MS, {
      MIN: 13000,
      FAQ: 13000,
      PRICE: 13000,
      CANCEL: 13000,
      BOOKING: 22000,
      FULL: 22000,
    });
    assert.equal(TESS_ABORT_HARD_CEILING_MS, 24000);
  });
});

describe('6.2 env na faixa / fora da faixa', () => {
  test('in-range overrides', () => {
    const env = {
      TESS_ABORT_MS_CANCEL: '9000',
      TESS_ABORT_MS_FULL: '20000',
    };
    assert.equal(resolveTessAbortMs(PROFILES.CANCEL, env), 9000);
    assert.equal(resolveTessAbortMs(PROFILES.FULL, env), 20000);
    const caps = parseAbortCaps(env);
    assert.equal(caps.CANCEL, 9000);
    assert.equal(caps.FULL, 20000);
    assert.equal(caps.FAQ, DEFAULT_ABORT_MS.FAQ);
  });

  test('out-of-range → default da tabela', () => {
    for (const bad of ['0', 'abc', '25000', '30000', '2000']) {
      const env = {
        TESS_ABORT_MS_CANCEL: bad,
        TESS_ABORT_MS_FULL: bad,
      };
      assert.equal(resolveTessAbortMs(PROFILES.CANCEL, env), 13000, `CANCEL with ${bad}`);
      assert.equal(resolveTessAbortMs(PROFILES.FULL, env), 22000, `FULL with ${bad}`);
    }
  });
});
