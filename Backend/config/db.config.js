import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

/* ─────────────────────────────────────────────────────────────────────────────
   requestTimeout: how long a single SQL query is allowed to run (ms).
   The default is 15000 (15 s) which is what was causing the timeout error.
   60000 (60 s) is a safe ceiling for heavy production queries.

   pool.min: keep 2 connections warm so the first request after a quiet period
   doesn't pay the reconnection cost.
───────────────────────────────────────────────────────────────────────────── */
const baseOptions = {
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout:   60_000,   // ← was implicitly 15 000 — the timeout cause
  connectionTimeout: 15_000,
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30_000,
  },
};

export const dbConfig1 = {
  user:     process.env.DB_USER1,
  password: process.env.DB_PASSWORD1,
  server:   process.env.DB_SERVER1,
  database: process.env.DB_NAME1,
  ...baseOptions,
};

export const dbConfig2 = {
  user:     process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  server:   process.env.DB_SERVER2,
  database: process.env.DB_NAME2,
  ...baseOptions,
};

export const dbConfig3 = {
  user:     process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  server:   process.env.DB_SERVER3,
  database: process.env.DB_NAME3,
  ...baseOptions,
};

export const dbConfig4 = {
  user:     process.env.DB_USER4,
  password: process.env.DB_PASSWORD4,
  server:   process.env.DB_SERVER4,
  database: process.env.DB_NAME4,
  ...baseOptions,
};

// ── Singleton pool manager (unchanged — your existing logic) ──────────────
const pools = new Map();

export const connectToDB = async (dbConfig) => {
  const key = `${dbConfig.server}_${dbConfig.database}`;

  if (pools.has(key)) {
    const existing = pools.get(key);
    // Guard: if the pool was closed or errored, reconnect
    if (existing.connected) return existing;
    pools.delete(key);
  }

  try {
    const pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();

    // If the pool errors out later, remove it so the next request reconnects cleanly
    pool.on("error", (err) => {
      console.error(`[DB Pool] Error on ${dbConfig.database}:`, err.message);
      pools.delete(key);
    });

    pools.set(key, pool);
    console.log(`Connected to ${dbConfig.database} ---> ${dbConfig.server}`);
    return pool;
  } catch (err) {
    console.error(`DB connection failed: ${dbConfig.database}`, err);
    throw err;
  }
};

export default sql;