/**
 * Postgres pool — singleton across hot reloads in dev.
 * Reuses the `influence_labs_salon` database with admin_* / kb_* / trinks_* schemas.
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env, isProd } from "./env";

declare global {
  var _pgPool: Pool | undefined;
}

export const pool: Pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // ssl is on by default for hosted providers when sslmode=require is in the URL
  });

if (!isProd) globalThis._pgPool = pool;

/** Convenience: parameterized query that returns rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<T[]> {
  const res = await pool.query<T>(text, params as unknown[]);
  return res.rows;
}

/** Run a callback inside a transaction. Rollback on throw. */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
