/**
 * PILOT_N — soft-open first-N.
 * Claim atômico de inbound não-trivial. Não é OPEN.
 */

const db = require('../db');
const { invalidateCache } = require('./bot-state');
const { digitsOnly, isOwnerPhone } = require('./owner-access');

const PILOT_TOGGLE_KEY = 'pilot';
const PILOT_LOCK_KEY = 881005;
const DEFAULT_N = 5;
const MAX_N = 20;

const CLAIMABLE_INTENTS = Object.freeze(['SCHEDULING', 'CANCEL', 'RESCHEDULE']);

function last4FromPhone(phone) {
  const digits = digitsOnly(phone);
  return digits ? digits.slice(-4) : null;
}

function isClaimableIntent(intent) {
  return CLAIMABLE_INTENTS.includes(String(intent || ''));
}

function clampN(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_N;
  return Math.min(MAX_N, Math.max(1, n));
}

async function setPilotToggle(enabled) {
  const result = await db.query(
    `INSERT INTO bot_toggles (key, enabled, description)
     VALUES ($1, $2, 'Soft-open first-N — Tess só reclama inbound não-trivial até o teto')
     ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled`,
    [PILOT_TOGGLE_KEY, Boolean(enabled)],
  );
  if (result === null) {
    throw new Error('db_unavailable');
  }
  invalidateCache();
}

async function getActiveRun() {
  const result = await db.query(
    `SELECT id, n, status, started_at, started_by
       FROM bot_pilot_runs
      WHERE status = 'active'
      LIMIT 1`,
  );
  if (result === null) return null;
  return result.rows[0] || null;
}

async function listClaims(runId) {
  const result = await db.query(
    `SELECT phone, intent, claimed_at
       FROM bot_pilot_claims
      WHERE run_id = $1
      ORDER BY claimed_at ASC`,
    [runId],
  );
  if (result === null) return [];
  return result.rows;
}

async function getPilotStatus() {
  const run = await getActiveRun();
  if (!run) {
    const last = await db.query(
      `SELECT id, n, status, started_at, stopped_at, started_by
         FROM bot_pilot_runs
        ORDER BY started_at DESC
        LIMIT 1`,
    );
    if (last === null) {
      return { table_ready: false, mode: 'UNKNOWN', n: null, claimed_count: 0, phones_last4: [] };
    }
    const row = last.rows[0];
    if (!row) {
      return { table_ready: true, mode: 'OFF', n: DEFAULT_N, claimed_count: 0, phones_last4: [], run_id: null };
    }
    const claims = await listClaims(row.id);
    return {
      table_ready: true,
      mode: row.status === 'active' ? 'PILOT' : 'OFF',
      n: row.n,
      claimed_count: claims.length,
      phones_last4: claims.map((c) => last4FromPhone(c.phone)).filter(Boolean),
      started_at: row.started_at,
      stopped_at: row.stopped_at || null,
      run_id: row.id,
      run_status: row.status,
    };
  }
  const claims = await listClaims(run.id);
  return {
    table_ready: true,
    mode: 'PILOT',
    n: run.n,
    claimed_count: claims.length,
    phones_last4: claims.map((c) => last4FromPhone(c.phone)).filter(Boolean),
    started_at: run.started_at,
    stopped_at: null,
    run_id: run.id,
    run_status: 'active',
  };
}

async function startPilot({ n = DEFAULT_N, startedBy = 'cli' } = {}) {
  const existing = await getActiveRun();
  if (existing) {
    const status = await getPilotStatus();
    return { ok: true, already_active: true, ...status };
  }
  const safeN = clampN(n);
  const inserted = await db.query(
    `INSERT INTO bot_pilot_runs (n, status, started_by)
     VALUES ($1, 'active', $2)
     RETURNING id, n, started_at`,
    [safeN, String(startedBy || 'cli').slice(0, 80)],
  );
  if (inserted === null || !inserted.rows[0]) {
    throw new Error('db_unavailable');
  }
  await setPilotToggle(true);
  return {
    ok: true,
    already_active: false,
    table_ready: true,
    mode: 'PILOT',
    n: inserted.rows[0].n,
    claimed_count: 0,
    phones_last4: [],
    started_at: inserted.rows[0].started_at,
    run_id: inserted.rows[0].id,
    run_status: 'active',
  };
}

async function stopPilot({ reason = 'cli' } = {}) {
  const run = await getActiveRun();
  await setPilotToggle(false);
  if (!run) {
    const status = await getPilotStatus();
    return { ok: true, already_off: true, ...status };
  }
  const updated = await db.query(
    `UPDATE bot_pilot_runs
        SET status = 'frozen', stopped_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING id, n, started_at, stopped_at`,
    [run.id],
  );
  if (updated === null) {
    throw new Error('db_unavailable');
  }
  const claims = await listClaims(run.id);
  return {
    ok: true,
    already_off: false,
    table_ready: true,
    mode: 'OFF',
    n: run.n,
    claimed_count: claims.length,
    phones_last4: claims.map((c) => last4FromPhone(c.phone)).filter(Boolean),
    started_at: run.started_at,
    stopped_at: updated.rows[0]?.stopped_at || new Date().toISOString(),
    run_id: run.id,
    run_status: 'frozen',
    stop_reason: reason,
  };
}

async function upsertAllow(client, phone) {
  await client.query(
    `INSERT INTO bot_whitelist (phone, mode, reason)
     VALUES ($1, 'allow', 'pilot_claim')
     ON CONFLICT (phone) DO UPDATE
       SET mode = 'allow', reason = 'pilot_claim'
     WHERE bot_whitelist.mode NOT IN ('block', 'human_only')`,
    [phone],
  );
}

/**
 * @returns {Promise<{ claimed: boolean, reason: string, run_id?: string }>}
 */
async function tryClaim({ phone, intent }) {
  const digits = digitsOnly(phone);
  if (!digits) return { claimed: false, reason: 'invalid_phone' };
  if (isOwnerPhone(digits)) return { claimed: false, reason: 'owner_excluded' };
  if (!isClaimableIntent(intent)) return { claimed: false, reason: 'intent_not_claimable' };

  if (typeof db.transaction !== 'function') {
    return { claimed: false, reason: 'db_unavailable' };
  }

  try {
    const result = await db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [PILOT_LOCK_KEY]);
      const runRes = await client.query(
        `SELECT id, n FROM bot_pilot_runs WHERE status = 'active' FOR UPDATE`,
      );
      const run = runRes.rows[0];
      if (!run) return { claimed: false, reason: 'no_active_run' };

      const listed = await client.query(
        `SELECT mode FROM bot_whitelist WHERE phone = $1`,
        [digits],
      );
      const mode = listed.rows[0]?.mode;
      if (mode === 'block' || mode === 'human_only') {
        return { claimed: false, reason: 'denylist', run_id: run.id };
      }

      const existing = await client.query(
        `SELECT 1 FROM bot_pilot_claims WHERE run_id = $1 AND phone = $2`,
        [run.id, digits],
      );
      if (existing.rows[0]) {
        return { claimed: true, reason: 'already_claimed', run_id: run.id };
      }

      const countRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM bot_pilot_claims WHERE run_id = $1`,
        [run.id],
      );
      if ((countRes.rows[0]?.c || 0) >= run.n) {
        return { claimed: false, reason: 'cap_reached', run_id: run.id };
      }

      await client.query(
        `INSERT INTO bot_pilot_claims (run_id, phone, intent)
         VALUES ($1, $2, $3)`,
        [run.id, digits, String(intent)],
      );
      await upsertAllow(client, digits);
      return { claimed: true, reason: 'claimed', run_id: run.id };
    });
    if (result.claimed && result.reason === 'claimed') {
      invalidateCache();
    }
    return result;
  } catch (err) {
    console.error('[bot-pilot] tryClaim failed:', err.message);
    return { claimed: false, reason: 'claim_error' };
  }
}

module.exports = {
  PILOT_TOGGLE_KEY,
  PILOT_LOCK_KEY,
  DEFAULT_N,
  CLAIMABLE_INTENTS,
  isClaimableIntent,
  last4FromPhone,
  getActiveRun,
  getPilotStatus,
  startPilot,
  stopPilot,
  tryClaim,
};
