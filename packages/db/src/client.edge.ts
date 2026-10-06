import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Without POSTGRES_URL the client is still created (importing this module must
// not crash the site); every query then fails against the placeholder URL and
// callers handle it as "database unavailable".
const sql = neon(
  process.env.POSTGRES_URL ??
    "postgres://unconfigured:unconfigured@localhost/db",
);
const db = drizzle(sql, {
  schema,
  casing: "snake_case",
});

export default db;

export { db };
