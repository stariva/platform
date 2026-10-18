import { expect, test } from "bun:test";
import { type AnyProcedure, call, Lazy, Procedure, unlazy } from "@orpc/server";
import { createWebORPCContext } from "../orpc";
import { ADMIN_SECRET, JOBS_SECRET } from "../testing/setup";
import { webRouter } from ".";

/*
 * Матрица доступа: каждая процедура webRouter против каждого вызывающего.
 *
 * Обработчик и схемы подменяются заглушкой, поэтому проверяются только
 * middleware доступа поддеревьев — без сервисов витрины. Новая процедура
 * без правила в `policy` или с доступом шире объявленного роняет тест.
 */

type Access = "public" | "jobs" | "admin";

/** Самое длинное совпавшее правило решает; `x.` — всё поддерево. */
const policy: [path: string, access: Access][] = [
  ["jobs.", "jobs"],
  ["admin.", "admin"],
  // Сессию кабинета проверяют сами обработчики: account.test.ts
  ["account.", "public"],
  ["forms.", "public"],
  // Покупателя подтверждает телефон из заказа: orders.test.ts
  ["orders.", "public"],
  ["checkout.", "public"],
];

const callers = {
  anonymous: null,
  wrongSecret: "Bearer not-the-secret",
  jobs: `Bearer ${JOBS_SECRET}`,
  admin: `Bearer ${ADMIN_SECRET}`,
} as const;
type Caller = keyof typeof callers;

const PASSED = "passed";
type Outcome =
  | typeof PASSED
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | `unexpected: ${string}`;

const expected: Record<Access, Record<Caller, Outcome>> = {
  public: {
    anonymous: PASSED,
    wrongSecret: PASSED,
    jobs: PASSED,
    admin: PASSED,
  },
  // Секрет воркера не открывает админку, и наоборот
  jobs: {
    anonymous: "UNAUTHORIZED",
    wrongSecret: "UNAUTHORIZED",
    jobs: PASSED,
    admin: "UNAUTHORIZED",
  },
  admin: {
    anonymous: "UNAUTHORIZED",
    wrongSecret: "UNAUTHORIZED",
    jobs: "UNAUTHORIZED",
    admin: PASSED,
  },
};

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

async function outcome(
  procedure: AnyProcedure,
  caller: Caller,
): Promise<Outcome> {
  const authorization = callers[caller];
  const headers = new Headers(authorization ? { authorization } : {});
  try {
    return (await call(guardsOnly(procedure), undefined, {
      context: createWebORPCContext({
        headers,
        services: {} as never,
        getSession: async () => null,
      }),
    })) as Outcome;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return code;
    return `unexpected: ${code ?? String(error)}`;
  }
}

const procedures = await collectProcedures(webRouter);

test("the router is not empty", () => {
  expect(procedures.length).toBeGreaterThan(10);
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
    const actual: Partial<Record<Caller, Outcome>> = {};
    for (const caller of Object.keys(callers) as Caller[]) {
      actual[caller] = await outcome(procedure, caller);
    }
    expect(actual).toEqual(expected[access]);
  });
}
