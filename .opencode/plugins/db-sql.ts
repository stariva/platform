import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Plugin } from "@opencode/plugin";
import { Client } from "pg";

/**
 * Read-only SQL for agents. Never writes: the query runs inside
 * `BEGIN TRANSACTION READ ONLY` and the SQL is checked before it is sent.
 * Connection string: POSTGRES_URL from the environment or the nearest `.env`.
 */
export default Plugin.define({
  id: "stariva.db-sql",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "db_sql",
        description:
          "Run one read-only SQL statement against the Stariva Postgres database " +
          "(SELECT, WITH, EXPLAIN, SHOW, TABLE, VALUES). Writes are rejected. " +
          "Returns columns and up to `limit` rows. Use migrations, not this tool, to change the schema.",
        input: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description:
                "A single read-only SQL statement without a trailing semicolon.",
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 1000,
              description: "Maximum rows to return. Default 200.",
            },
          },
          required: ["sql"],
          additionalProperties: false,
        },
        options: { codemode: true },
        execute: async (input) => {
          const { sql, limit } = input as { sql: string; limit?: number };
          const rowLimit = Number.isFinite(limit)
            ? Math.min(Math.max(Math.trunc(limit as number), 1), 1000)
            : 200;
          const connectionString = findConnectionString(ctx.location.directory);
          if (!connectionString) {
            return {
              content:
                "ERROR: POSTGRES_URL is not set in the environment and no .env with POSTGRES_URL was found. " +
                "Add it to .env (see .env.example).",
            };
          }

          const client = new Client({
            connectionString,
            application_name: "opencode-db-sql",
            statement_timeout: 10_000,
            query_timeout: 15_000,
          });

          try {
            const statement = validateReadOnly(sql);
            await client.connect();
            await client.query("BEGIN TRANSACTION READ ONLY");
            try {
              const result = await client.query({
                text: applyRowLimit(statement, rowLimit),
                rowMode: "array",
              });
              await client.query("ROLLBACK");
              return { content: formatResult(result, rowLimit) };
            } catch (error) {
              await client.query("ROLLBACK").catch(() => {});
              return { content: `ERROR: ${redact(error, connectionString)}` };
            }
          } catch (error) {
            return { content: `ERROR: ${redact(error, connectionString)}` };
          } finally {
            await client.end().catch(() => {});
          }
        },
      });
    });
  },
});

const ALLOWED_START = /^(select|with|explain|show|table|values)\b/i;

// Rejected anywhere outside strings/comments. The read-only transaction is the
// real guard; this list only keeps accidental writes out of the query path.
const FORBIDDEN =
  /\b(insert|update|delete|merge|upsert|create|alter|drop|truncate|grant|revoke|copy|do|call|vacuum|analyze|refresh|reindex|listen|notify|set|reset|begin|commit|rollback|savepoint|lock|prepare|execute|deallocate|discard|reassign|import|load|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|lo_create|lo_unlink|dblink|set_config|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_switch_wal|pg_create_restore_point|pg_promote|pg_wal_replay_pause|pg_wal_replay_resume|pg_advisory_lock|pg_advisory_xact_lock)\b/i;

function applyRowLimit(statement: string, limit: number): string {
  const keyword = statement.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
  if (keyword === "select" || keyword === "with" || keyword === "values") {
    return `SELECT * FROM (${statement}) AS _opencode_q LIMIT ${limit + 1}`;
  }
  if (keyword === "table") {
    const source = statement.replace(/^table\s+/i, "");
    return `SELECT * FROM (SELECT * FROM ${source}) AS _opencode_q LIMIT ${limit + 1}`;
  }
  // EXPLAIN and SHOW produce a small, bounded result.
  return statement;
}

function validateReadOnly(sql: string): string {
  const statement = sql.trim().replace(/;\s*$/, "");
  if (!statement) throw new Error("SQL is empty.");
  if (!ALLOWED_START.test(statement)) {
    throw new Error(
      "Only read-only statements are allowed: SELECT, WITH, EXPLAIN, SHOW, TABLE, VALUES.",
    );
  }

  const bare = stripLiteralsAndComments(statement);
  if (bare.includes(";")) {
    throw new Error("Only one statement per call is allowed.");
  }
  const forbidden = bare.match(FORBIDDEN);
  if (forbidden) {
    throw new Error(
      `Statement contains a forbidden keyword: ${forbidden[1].toUpperCase()}.`,
    );
  }
  return statement;
}

function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\$(?:\w*)\$[\s\S]*?\$\w*\$/g, "''")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

function formatResult(
  result: {
    command: string;
    rowCount: number | null;
    fields: { name: string }[];
    rows: unknown[][];
  },
  limit: number,
): string {
  const rows = result.rows
    .slice(0, limit)
    .map((row) =>
      Object.fromEntries(
        result.fields.map((field, index) => [
          field.name,
          formatValue(row[index]),
        ]),
      ),
    );
  return JSON.stringify(
    {
      command: result.command,
      rowCount: result.rowCount,
      returned: rows.length,
      truncated: result.rows.length > limit,
      columns: result.fields.map((field) => field.name),
      rows,
    },
    null,
    2,
  );
}

function formatValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `<bytea ${value.length} bytes>`;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}тАж[${value.length - 500} chars truncated]`;
  }
  if (typeof value === "object") {
    return JSON.parse(
      JSON.stringify(value, (_key, nested) =>
        typeof nested === "bigint" ? nested.toString() : nested,
      ),
    );
  }
  return value;
}

function findConnectionString(start: string): string | undefined {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  let directory = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const envPath = join(directory, ".env");
    if (existsSync(envPath)) {
      const line = readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .find((entry) => /^\s*POSTGRES_URL\s*=/.test(entry));
      if (line) {
        const raw = line.slice(line.indexOf("=") + 1).trim();
        const value = raw.replace(/^(['"])([\s\S]*)\1$/, "$2");
        if (value) return value;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return undefined;
}

function redact(error: unknown, connectionString: string): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  const visit = (current: unknown, depth: number) => {
    if (current === null || current === undefined || depth > 3) return;
    if (typeof current === "object" && seen.has(current)) return;
    if (typeof current === "object") seen.add(current);

    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      const detail = [current.name, current.message || "(no message)", code]
        .filter(Boolean)
        .join(": ");
      parts.push(detail);
      visit((current as { cause?: unknown }).cause, depth + 1);
      const errors = (current as { errors?: unknown[] }).errors;
      if (Array.isArray(errors)) {
        for (const nested of errors) visit(nested, depth + 1);
      }
      return;
    }

    parts.push(String(current) || JSON.stringify(current) || "(unknown error)");
  };

  visit(error, 0);
  const target = describeTarget(connectionString);
  const message = parts.join(" <- ") || "unknown error";
  return `${message} (target ${target})`
    .split(connectionString)
    .join("[redacted connection string]");
}

function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "unparseable connection string";
  }
}
