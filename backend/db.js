const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
    pool.on('error', (err) => console.error('[DB] Pool error:', err.message));
  }
  return pool;
}

async function query(sql, params) {
  const p = getPool();
  if (!p) return null;
  try {
    return await p.query(sql, params);
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    return null;
  }
}

async function transaction(fn) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL ausente');
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function getPoolStats() {
  const p = getPool();
  if (!p) return null;
  return {
    total: p.totalCount,
    idle: p.idleCount,
    waiting: p.waitingCount,
  };
}

module.exports = { query, transaction, getPoolStats };
