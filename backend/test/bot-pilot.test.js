/**
 * Testes unitários — backend/lib/bot-pilot.js
 *   node --test test/bot-pilot.test.js
 */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../db');
const botPilotPath = require.resolve('../lib/bot-pilot');
const botStatePath = require.resolve('../lib/bot-state');
const ownerAccessPath = require.resolve('../lib/owner-access');

let runs = [];
let claims = [];
let whitelist = new Map();
let toggles = new Map();
let lockCalls = 0;

function resetStores() {
  runs = [];
  claims = [];
  whitelist = new Map();
  toggles = new Map();
  lockCalls = 0;
}

function setupMocks({ ownerPhones = ['5511937750330'] } = {}) {
  resetStores();
  require.cache[ownerAccessPath] = {
    id: ownerAccessPath,
    filename: ownerAccessPath,
    loaded: true,
    exports: {
      digitsOnly: (v) => String(v || '').replace(/\D/g, ''),
      isOwnerPhone: (phone) => ownerPhones.includes(String(phone || '').replace(/\D/g, '')),
    },
  };
  require.cache[botStatePath] = {
    id: botStatePath,
    filename: botStatePath,
    loaded: true,
    exports: {
      invalidateCache: () => {},
    },
  };

  function handleQuery(sql, params = []) {
    if (sql.includes('pg_advisory_xact_lock')) {
      lockCalls += 1;
      return { rows: [] };
    }
    if (sql.includes('FROM bot_pilot_runs') && sql.includes("status = 'active'") && sql.includes('FOR UPDATE')) {
      const row = runs.find((r) => r.status === 'active');
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('FROM bot_pilot_runs') && sql.includes("status = 'active'")) {
      const row = runs.find((r) => r.status === 'active');
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('FROM bot_pilot_runs') && sql.includes('ORDER BY started_at DESC')) {
      const sorted = [...runs].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      return { rows: sorted[0] ? [sorted[0]] : [] };
    }
    if (sql.includes('INSERT INTO bot_pilot_runs')) {
      const row = {
        id: `run-${runs.length + 1}`,
        n: params[0],
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: params[1],
        stopped_at: null,
      };
      runs.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE bot_pilot_runs')) {
      const id = params[0];
      const row = runs.find((r) => r.id === id && r.status === 'active');
      if (!row) return { rows: [] };
      row.status = 'frozen';
      row.stopped_at = new Date().toISOString();
      return { rows: [row] };
    }
    if (sql.includes('FROM bot_pilot_claims') && sql.includes('AND phone')) {
      const hit = claims.find((c) => c.run_id === params[0] && c.phone === params[1]);
      return { rows: hit ? [hit] : [] };
    }
    if (sql.includes('COUNT(*)') && sql.includes('bot_pilot_claims')) {
      const c = claims.filter((x) => x.run_id === params[0]).length;
      return { rows: [{ c }] };
    }
    if (sql.includes('FROM bot_pilot_claims')) {
      return { rows: claims.filter((c) => c.run_id === params[0]) };
    }
    if (sql.includes('INSERT INTO bot_pilot_claims')) {
      claims.push({
        run_id: params[0],
        phone: params[1],
        intent: params[2],
        claimed_at: new Date().toISOString(),
      });
      return { rows: [] };
    }
    if (sql.includes('SELECT mode FROM bot_whitelist')) {
      const mode = whitelist.get(params[0]);
      return { rows: mode ? [{ mode }] : [] };
    }
    if (sql.includes('INSERT INTO bot_whitelist')) {
      const phone = params[0];
      const current = whitelist.get(phone);
      if (current === 'block' || current === 'human_only') {
        return { rows: [] };
      }
      whitelist.set(phone, 'allow');
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO bot_toggles')) {
      toggles.set(params[0], Boolean(params[1]));
      return { rows: [] };
    }
    return { rows: [] };
  }

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, params) => handleQuery(sql, params),
      transaction: async (fn) => fn({ query: async (sql, params) => handleQuery(sql, params) }),
    },
  };
  delete require.cache[botPilotPath];
}

afterEach(() => {
  delete require.cache[dbPath];
  delete require.cache[botPilotPath];
  delete require.cache[botStatePath];
  delete require.cache[ownerAccessPath];
});

test('isClaimableIntent só SCHEDULING/CANCEL/RESCHEDULE', () => {
  setupMocks();
  const { isClaimableIntent } = require('../lib/bot-pilot');
  assert.equal(isClaimableIntent('SCHEDULING'), true);
  assert.equal(isClaimableIntent('CANCEL'), true);
  assert.equal(isClaimableIntent('RESCHEDULE'), true);
  assert.equal(isClaimableIntent('TRIVIAL'), false);
  assert.equal(isClaimableIntent('FAQ'), false);
  assert.equal(isClaimableIntent('PRICING'), false);
  assert.equal(isClaimableIntent('UNCERTAIN'), false);
});

test('trivial não claima', async () => {
  setupMocks();
  const { startPilot, tryClaim, getPilotStatus } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  const r = await tryClaim({ phone: '5511999000001', intent: 'TRIVIAL' });
  assert.deepEqual(r, { claimed: false, reason: 'intent_not_claimable' });
  const status = await getPilotStatus();
  assert.equal(status.claimed_count, 0);
});

test('SCHEDULING claima e vira allow', async () => {
  setupMocks();
  const { startPilot, tryClaim, getPilotStatus } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  const r = await tryClaim({ phone: '5511999000002', intent: 'SCHEDULING' });
  assert.equal(r.claimed, true);
  assert.equal(r.reason, 'claimed');
  assert.equal(whitelist.get('5511999000002'), 'allow');
  const status = await getPilotStatus();
  assert.equal(status.claimed_count, 1);
  assert.deepEqual(status.phones_last4, ['0002']);
});

test('race: n=1, dois phones → um claimed', async () => {
  setupMocks();
  const { startPilot, tryClaim } = require('../lib/bot-pilot');
  await startPilot({ n: 1 });
  const a = await tryClaim({ phone: '5511999000011', intent: 'SCHEDULING' });
  const b = await tryClaim({ phone: '5511999000012', intent: 'CANCEL' });
  assert.equal(a.claimed, true);
  assert.equal(b.claimed, false);
  assert.equal(b.reason, 'cap_reached');
  assert.equal(claims.length, 1);
  assert.ok(lockCalls >= 2);
});

test('6º número após teto 5 → cap_reached', async () => {
  setupMocks();
  const { startPilot, tryClaim } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  for (let i = 1; i <= 5; i += 1) {
    const r = await tryClaim({ phone: `55119990000${10 + i}`, intent: 'SCHEDULING' });
    assert.equal(r.claimed, true);
  }
  const sixth = await tryClaim({ phone: '5511999000099', intent: 'CANCEL' });
  assert.equal(sixth.claimed, false);
  assert.equal(sixth.reason, 'cap_reached');
  assert.equal(claims.length, 5);
  assert.equal(whitelist.has('5511999000099'), false);
});

test('already_claimed não incrementa', async () => {
  setupMocks();
  const { startPilot, tryClaim, getPilotStatus } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  await tryClaim({ phone: '5511999000033', intent: 'SCHEDULING' });
  const again = await tryClaim({ phone: '5511999000033', intent: 'CANCEL' });
  assert.equal(again.claimed, true);
  assert.equal(again.reason, 'already_claimed');
  assert.equal((await getPilotStatus()).claimed_count, 1);
});

test('owner não ocupa vaga', async () => {
  setupMocks();
  const { startPilot, tryClaim, getPilotStatus } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  const r = await tryClaim({ phone: '5511937750330', intent: 'SCHEDULING' });
  assert.equal(r.claimed, false);
  assert.equal(r.reason, 'owner_excluded');
  assert.equal((await getPilotStatus()).claimed_count, 0);
});

test('stop congela e desliga toggle', async () => {
  setupMocks();
  const { startPilot, tryClaim, stopPilot } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  await tryClaim({ phone: '5511999000044', intent: 'RESCHEDULE' });
  const stopped = await stopPilot({ reason: 'cli' });
  assert.equal(stopped.mode, 'OFF');
  assert.equal(stopped.run_status, 'frozen');
  assert.equal(stopped.claimed_count, 1);
  assert.equal(toggles.get('pilot'), false);
  assert.equal(whitelist.get('5511999000044'), 'allow');
});

test('tryClaim sem run ativo → no_active_run', async () => {
  setupMocks();
  const { tryClaim } = require('../lib/bot-pilot');
  const r = await tryClaim({ phone: '5511999000055', intent: 'SCHEDULING' });
  assert.equal(r.claimed, false);
  assert.equal(r.reason, 'no_active_run');
});

test('block na whitelist não claima nem sobrescreve', async () => {
  setupMocks();
  whitelist.set('5511999000066', 'block');
  const { startPilot, tryClaim, getPilotStatus } = require('../lib/bot-pilot');
  await startPilot({ n: 5 });
  const r = await tryClaim({ phone: '5511999000066', intent: 'SCHEDULING' });
  assert.equal(r.claimed, false);
  assert.equal(r.reason, 'denylist');
  assert.equal(whitelist.get('5511999000066'), 'block');
  assert.equal((await getPilotStatus()).claimed_count, 0);
});
