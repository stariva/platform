import { type NeonQueryFunction, neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Importing without POSTGRES_URL must not crash the site. Queries fail locally
// so callers can handle "database unavailable" without making a network request.
function unavailable(): never {
  throw new Error(
    "POSTGRES_URL environment variable is not set. Please configure it in your environment.",
  );
}

const connectionString = process.env.POSTGRES_URL;
const sql: NeonQueryFunction<false, false> = connectionString
  ? neon(connectionString)
  : Object.assign(unavailable, {
      query: unavailable,
      unsafe: unavailable,
      transaction: unavailable,
    });
const db = drizzle(sql, {
  schema,
  casing: "snake_case",
});

export default db;

export { db };
