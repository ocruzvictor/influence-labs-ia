/**
 * Integration test helpers — shared by tests/api/*.test.ts.
 *
 * Pre-requisite: postgres-test container running.
 *   docker compose --profile test up -d postgres-test
 *
 * Environment override:
 *   TEST_DATABASE_URL=postgres://postgres:test@localhost:5433/influence_labs_salon
 *
 * When TEST_DATABASE_URL is not set, integration tests are SKIPPED (not failed).
 * Tests should call `requireDb()` at top of each `test()` to early-return.
 */

import { test as nodeTest } from "node:test";
import { query, pool } from "../../lib/db";

/** Detect whether integration DB is reachable. Cached after first probe. */
let dbAvailableCache: boolean | null = null;

export async function isDbAvailable(): Promise<boolean> {
  if (dbAvailableCache !== null) return dbAvailableCache;
  if (!process.env.DATABASE_URL?.includes("5433")) {
    // Heuristic: the integration test URL points at port 5433 (postgres-test).
    // If pointing elsewhere we don't run integration tests.
    dbAvailableCache = false;
    return false;
  }
  try {
    await query("SELECT 1");
    dbAvailableCache = true;
    return true;
  } catch {
    dbAvailableCache = false;
    return false;
  }
}

/**
 * Wrap `node:test` test() so it skips cleanly when DB not available.
 * Usage:
 *   dbTest("AC2: empty list", async () => { ... });
 */
export function dbTest(name: string, fn: () => Promise<void>): void {
  nodeTest(name, async (t) => {
    if (!(await isDbAvailable())) {
      t.skip(
        "postgres-test container not reachable. Run: docker compose --profile test up -d postgres-test",
      );
      return;
    }
    await fn();
  });
}

/** Truncate the tables used by integration tests AND reseed the deterministic state. */
export async function resetDb(): Promise<void> {
  await query(`TRUNCATE
    admin_audit_log,
    admin_sessions,
    magic_link_tokens,
    bot_whitelist,
    bot_toggles,
    conversation_history,
    admin_users
    RESTART IDENTITY CASCADE`);

  // Reseed toggles (mirror migration 001 seeds)
  await query(
    `INSERT INTO bot_toggles (key, enabled, description) VALUES
      ('global',             TRUE,  'Kill switch global'),
      ('feature:audio',      TRUE,  'Audio support'),
      ('feature:supervisor', TRUE,  'Supervisor agent')`,
  );

  // Reseed whitelist (mirror migration 002 seeds)
  await query(
    `INSERT INTO bot_whitelist (phone, mode, reason, added_by) VALUES
      ('5511964540007', 'allow', 'Seed (test)', NULL),
      ('5511964540330', 'allow', 'Seed (test)', NULL),
      ('5511964542495', 'allow', 'Seed (test)', NULL)`,
  );
}

/** Create an admin_users row for audit log foreign keys. Returns the UUID. */
export async function createTestUser(
  email = "test-admin@example.com",
  name = "Test Admin",
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO admin_users (email, name, role, active)
     VALUES ($1, $2, 'admin', TRUE)
     RETURNING id`,
    [email, name],
  );
  return rows[0]!.id;
}

/** Inserts a message into conversation_history. Returns row id. */
export async function insertMessage(opts: {
  phone: string;
  role?: string;
  content?: string;
  agent?: string | null;
  intent?: string | null;
  createdAt?: Date;
}): Promise<number> {
  const created = opts.createdAt ?? new Date();
  const rows = await query<{ id: number }>(
    `INSERT INTO conversation_history
       (client_phone, role, content, agent, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      opts.phone,
      opts.role ?? "user",
      opts.content ?? "hello",
      opts.agent ?? null,
      opts.intent ?? null,
      created,
    ],
  );
  return rows[0]!.id;
}

/** Close pg pool — must be called once at end of suite to let `node --test` exit. */
export async function closePool(): Promise<void> {
  await pool.end();
}

// Auto-close pool on process exit so test runner can terminate cleanly without
// each test file having to register its own `after()` hook (which would close
// the pool prematurely for sibling files in the same process).
let teardownRegistered = false;
function registerTeardownOnce(): void {
  if (teardownRegistered) return;
  teardownRegistered = true;
  process.on("beforeExit", () => {
    pool.end().catch(() => {
      /* swallow — pool may already be ended */
    });
  });
}
registerTeardownOnce();
