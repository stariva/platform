import { afterAll, beforeAll, expect, test } from "bun:test";
import { type AnyProcedure, call, Lazy, Procedure, unlazy } from "@orpc/server";

/*
 * Матрица доступа: каждая процедура appRouter против каждой роли.
 *
 * Обработчик и схемы подменяются заглушкой, поэтому проверяются только
 * middleware доступа — без базы, хранилища и побочных эффектов. Новая
 * процедура без правила в `policy` или с доступом шире объявленного роняет
 * тест.
 */

type Access = "public" | "user" | "admin";

/** Самое длинное совпавшее правило решает; `x.` — всё поддерево. */
const policy: [path: string, access: Access][] = [
  ["user.", "user"],
  ["post.list", "public"],
  ["post.byId", "public"],
  ["post.create", "admin"],
  ["post.delete", "admin"],
  ["admin.", "admin"],
];

const ADMIN = "owner@example.com";
const roles = {
  anonymous: null,
  customer: { email: "customer@example.com", emailVerified: true },
  // Адрес из ADMIN_EMAILS без подтверждения — не админ
  unverifiedAdmin: { email: ADMIN, emailVerified: false },
  admin: { email: ADMIN, emailVerified: true },
} as const;
type Role = keyof typeof roles;

const PASSED = "passed";
type Outcome =
  | typeof PASSED
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | `unexpected: ${string}`;

const expected: Record<Access, Record<Role, Outcome>> = {
  public: {
    anonymous: PASSED,
    customer: PASSED,
    unverifiedAdmin: PASSED,
    admin: PASSED,
  },
  user: {
    anonymous: "UNAUTHORIZED",
    customer: PASSED,
    unverifiedAdmin: PASSED,
    admin: PASSED,
  },
  admin: {
    anonymous: "UNAUTHORIZED",
    customer: "FORBIDDEN",
    unverifiedAdmin: "FORBIDDEN",
    admin: PASSED,
  },
};

// Импорт роутера создаёт пул; запросов в базу тест не делает.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/orpc_test";
const { appRouter } = await import("./routers");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

async function collectProcedures(
  node: unknown,
  path: string[] = [],
): Promise<[string, AnyProcedure][]> {
  const value = node instanceof Lazy ? (await unlazy(node)).default : node;
  if (value instanceof Procedure) return [[path.join("."), value]];
  if (!value || typeof value !== "object") return [];
  const entries = await Promise.all(
    Object.entries(value).map(([key, child]) =>
      collectProcedures(child, [...path, key]),
    ),
  );
  return entries.flat();
}

function accessFor(path: string): Access | undefined {
  let best: [string, Access] | undefined;
  for (const rule of policy) {
    const [prefix] = rule;
    const matches = prefix.endsWith(".")
      ? path.startsWith(prefix)
      : path === prefix;
    if (matches && (!best || prefix.length > best[0].length)) best = rule;
  }
  return best?.[1];
}

/** Та же цепочка middleware, но вместо схем и обработчика — заглушка. */
function guardsOnly(procedure: AnyProcedure): AnyProcedure {
  return new Procedure({
    ...procedure["~orpc"],
    inputSchemas: [],
    outputSchemas: [],
    handler: () => PASSED,
  });
}

async function outcome(procedure: AnyProcedure, role: Role): Promise<Outcome> {
  const user = roles[role];
  const session = user
    ? ({ user: { id: "u1", name: "U", ...user }, session: {} } as never)
    : null;
  try {
    return (await call(guardsOnly(procedure), undefined, {
      context: { session, headers: new Headers(), db: {} as never },
    })) as Outcome;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return code;
    return `unexpected: ${code ?? String(error)}`;
  }
}

const procedures = await collectProcedures(appRouter);

const originalAdmins = process.env.ADMIN_EMAILS;
beforeAll(() => {
  process.env.ADMIN_EMAILS = ADMIN;
});
afterAll(() => {
  if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdmins;
});

test("the router is not empty", () => {
  expect(procedures.length).toBeGreaterThan(50);
});

test("every procedure has an access rule", () => {
  const uncovered = procedures
    .map(([path]) => path)
    .filter((path) => !accessFor(path));
  expect(uncovered).toEqual([]);
});

test("every access rule matches a procedure", () => {
  const stale = policy
    .map(([prefix]) => prefix)
    .filter(
      (prefix) =>
        !procedures.some(([path]) =>
          prefix.endsWith(".") ? path.startsWith(prefix) : path === prefix,
        ),
    );
  expect(stale).toEqual([]);
});

for (const [path, procedure] of procedures) {
  const access = accessFor(path);
  if (!access) continue;
  test(`${path} is ${access}`, async () => {
    const actual: Partial<Record<Role, Outcome>> = {};
    for (const role of Object.keys(roles) as Role[]) {
      actual[role] = await outcome(procedure, role);
    }
    expect(actual).toEqual(expected[access]);
  });
}
