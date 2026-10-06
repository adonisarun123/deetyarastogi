import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __bakesPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
}

export function pool(): Pool {
  if (!globalThis.__bakesPool) globalThis.__bakesPool = createPool();
  return globalThis.__bakesPool;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export type Queryable = Pick<PoolClient, "query">;

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool(),
): Promise<T[]> {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool(),
): Promise<T | null> {
  const rows = await q<T>(text, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
