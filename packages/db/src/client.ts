import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool, type PoolConfig } from "pg";
import { type DbDriver, selectDbDriver } from "./driver";
import * as schema from "./schema";

/**
 * Unified database type used across the codebase.
 *
 * Both the `node-postgres` and `neon-http` drivers extend `PgDatabase` with
 * different query-result HKTs but share the same relational query API for a
 * given schema.  Using `PgDatabase` as the common interface avoids unsafe
 * double-casting while keeping full access to select/insert/update/delete and
 * the relational `query` builder.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const NOT_CONFIGURED_MESSAGE =
  "POSTGRES_URL environment variable is not set. Please configure it in your environment.";

/**
 * Stand-in pool used while POSTGRES_URL is not set. It never opens a socket:
 * importing `@stariva/db` must not crash the site, so the failure is deferred
 * to the first query, where callers already handle "database unavailable"
 * (catalog and workshops fall back to an empty state).
 */
class UnconfiguredPool extends Pool {
  query(): Promise<never> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }

  connect(): Promise<never> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }
}

/** An explicit driver allows callers that need interactive transactions to use TCP. */
type ConnectionOptions = Pick<PoolConfig, "connectionTimeoutMillis">;

export function createDatabase(
  driver: "node",
  options?: ConnectionOptions,
): NodePgDatabase<typeof schema>;
export function createDatabase(driver?: DbDriver): Database;
export function createDatabase(
  driver?: DbDriver,
  options?: ConnectionOptions,
): Database {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn(
      "[db] POSTGRES_URL is not set: database queries will fail until it is configured.",
    );
    return drizzlePg({
      client: new UnconfiguredPool(),
      schema,
      casing: "snake_case",
    });
  }

  if ((driver ?? selectDbDriver(connectionString)) === "neon-http") {
    const sql = neon(connectionString);
    return drizzleNeonHttp(sql, {
      schema,
      casing: "snake_case",
    });
  }

  const pool = new Pool({ connectionString, ...options });
  return drizzlePg({ client: pool, schema, casing: "snake_case" });
}

export const db: Database = createDatabase();
