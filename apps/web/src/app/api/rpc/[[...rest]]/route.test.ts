import { expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { corsPreflight, withCors } from "@stariva/auth/cors";
import { MOBILE_APP_ORIGINS } from "@stariva/auth/origins";
import {
  createWebORPCContext,
  type WebServices,
  webErrorStatusMap,
  webRouter,
} from "@stariva/web-api";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";

/*
 * Сам route.ts тянет за собой всю витрину (заказы, почту, базу), поэтому его
 * здесь не импортируем: чужие тесты подменяют его зависимости, и общий прогон
 * `bun test` ломается. Проверяем то, что route.ts делает с CORS, тем же
 * кодом: настоящий обработчик oRPC + withCors, а что route.ts подключил их —
 * читаем из исходника.
 */

const SITE = "https://stariva.ru";

// better-auth подменён: getSession пускает по токену «good», как это делает
// bearer-плагин. Он, как и в route.ts, получает заголовки запроса как есть.
const getSession = mock(async ({ headers }: { headers: Headers }) =>
  headers.get("authorization") === "Bearer good"
    ? { user: { id: "u1" } }
    : null,
);

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
});

/** То, что экспортирует route.ts: обработчик oRPC с CORS. */
async function post(request: Request) {
  const { matched, response } = await handler.handle(request, {
    prefix: WEB_RPC_PATH,
    context: () =>
      createWebORPCContext({
        headers: request.headers,
        services: {
          issueFormToken: async () => "1700000000.signature",
        } as unknown as WebServices,
        getSession: () =>
          getSession({ headers: request.headers }) as Promise<never>,
      }),
  });
  return withCors(
    request,
    matched ? response : new Response("Not found", { status: 404 }),
  );
}
const options = (request: Request) => corsPreflight(request);

/** Клиент так, как его собирает приложение: чужой origin, без cookie. */
function mobileClient(origin: string, token?: string) {
  const seen: Request[] = [];
  const client: WebClient = createORPCClient(
    new RPCLink({
      url: `${SITE}${WEB_RPC_PATH}` as never,
      fetch: async (url, init) => {
        const headers = new Headers(init?.headers);
        headers.set("origin", origin);
        if (token) headers.set("authorization", `Bearer ${token}`);
        const request = new Request(url, { ...init, headers });
        seen.push(request);
        return post(request);
      },
    }),
  );
  return { client, seen };
}

for (const origin of MOBILE_APP_ORIGINS) {
  test(`${origin}: preflight на /api/rpc разрешает точный origin и Authorization`, () => {
    const res = options(
      new Request(`${SITE}${WEB_RPC_PATH}/forms/formToken`, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization, content-type",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
    expect(res.headers.has("access-control-allow-credentials")).toBe(false);
  });
}

test("preflight с чужого origin отклоняется", () => {
  for (const origin of ["https://evil.example", "http://localhost", "null"]) {
    const res = options(
      new Request(`${SITE}${WEB_RPC_PATH}/forms/formToken`, {
        method: "OPTIONS",
        headers: { origin, "access-control-request-method": "POST" },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
  }
});

test("вызов из приложения: ответ с CORS, а заголовки клиента oRPC — в списке разрешённых", async () => {
  const { client, seen } = mobileClient("https://localhost");
  const { token } = await client.forms.formToken();
  expect(token).toMatch(/^\d+\./);

  const request = seen[0] as Request;
  // Всё, что oRPC-клиент реально отправил, preflight должен разрешать
  const preflight = options(
    new Request(request.url, {
      method: "OPTIONS",
      headers: {
        origin: "https://localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": [...request.headers.keys()]
          .filter((name) => name !== "origin")
          .join(", "),
      },
    }),
  );
  const allowed = (preflight.headers.get("access-control-allow-headers") ?? "")
    .split(",")
    .map((h) => h.trim());
  for (const name of request.headers.keys()) {
    if (name === "origin") continue;
    expect(allowed).toContain(name);
  }

  const raw = await post(request.clone());
  expect(raw.headers.get("access-control-allow-origin")).toBe(
    "https://localhost",
  );
  expect(raw.headers.get("vary")).toContain("Origin");
});

test("ответ об ошибке и 404 тоже читаются приложением", async () => {
  const res = await post(
    new Request(`${SITE}${WEB_RPC_PATH}/nope/nothing`, {
      method: "POST",
      headers: { origin: "capacitor://localhost" },
    }),
  );
  expect(res.status).toBe(404);
  expect(res.headers.get("access-control-allow-origin")).toBe(
    "capacitor://localhost",
  );
});

test("со своего сайта и без origin CORS-заголовков нет", async () => {
  for (const origin of [SITE, null]) {
    const res = await post(
      new Request(`${SITE}${WEB_RPC_PATH}/nope/nothing`, {
        method: "POST",
        headers: origin ? { origin } : {},
      }),
    );
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
  }
});

test("процедуры кабинета передают Authorization в getSession (bearer-плагин)", async () => {
  const call = { slug: "elka", lessonId: "l1" };
  getSession.mockClear();

  // Дальше getSession процедура идёт к базе, которой в тесте нет: ошибка
  // нам не важна, важно, что токен приложения дошёл до better-auth как есть
  const { client } = mobileClient("https://localhost", "good");
  await client.account.lessonDetails(call).catch(() => {});
  expect(getSession).toHaveBeenCalledTimes(1);
  const [{ headers }] = getSession.mock.calls[0] as [{ headers: Headers }];
  expect(headers.get("authorization")).toBe("Bearer good");

  // Без токена заголовка нет — сессии тоже
  getSession.mockClear();
  const { client: anonymous } = mobileClient("https://localhost");
  await anonymous.account.lessonDetails(call).catch(() => {});
  const [{ headers: anonymousHeaders }] = getSession.mock.calls[0] as [
    { headers: Headers },
  ];
  expect(anonymousHeaders.get("authorization")).toBeNull();
});

test("route.ts отдаёт OPTIONS и оборачивает POST в CORS, без своих Allow-Origin/Credentials", () => {
  const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
  expect(source).toContain('from "@stariva/auth/cors"');
  expect(source).toMatch(
    /export const OPTIONS\s*=\s*\(request: Request\)\s*=>\s*corsPreflight\(request\)/,
  );
  expect(source).toMatch(
    /export const POST\s*=\s*async \(request: Request\)\s*=>\s*withCors\(request, await handleRequest\(request\)\)/,
  );
  expect(source).not.toMatch(/access-control-allow-(credentials|origin)/i);
});
