import { expect, test } from "bun:test";
import {
  allowedCorsOrigin,
  CORS_ALLOWED_HEADERS,
  corsPreflight,
  withCors,
} from "./cors";
import { MOBILE_APP_ORIGINS } from "./origins";

const URL_ = "https://stariva.ru/api/rpc/forms/formToken";

function request(origin: string | null, method = "POST") {
  return new Request(URL_, {
    method,
    headers: origin ? { origin } : {},
  });
}

test("точные origin'ы приложения разрешены, остальные нет", () => {
  for (const origin of MOBILE_APP_ORIGINS) {
    expect(allowedCorsOrigin(request(origin))).toBe(origin);
  }
  expect(allowedCorsOrigin(request(null))).toBeNull();
  expect(allowedCorsOrigin(request("null"))).toBeNull();
  expect(allowedCorsOrigin(request("https://stariva.ru"))).toBeNull();
  // не префикс, не поддомен, не другой порт/схема
  expect(allowedCorsOrigin(request("https://localhost.evil.com"))).toBeNull();
  expect(allowedCorsOrigin(request("https://evil.localhost"))).toBeNull();
  expect(allowedCorsOrigin(request("https://localhost:3000"))).toBeNull();
  expect(allowedCorsOrigin(request("http://localhost"))).toBeNull();
  expect(
    allowedCorsOrigin(request("capacitor://localhost.evil.com")),
  ).toBeNull();
});

test("preflight: разрешённому origin отдаём 204 и точный origin без *", () => {
  for (const origin of MOBILE_APP_ORIGINS) {
    const res = corsPreflight(request(origin, "OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("vary")).toContain("Origin");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    const allowed = res.headers.get("access-control-allow-headers") ?? "";
    for (const header of CORS_ALLOWED_HEADERS) {
      expect(allowed).toContain(header);
    }
    expect(allowed).toContain("authorization");
    expect(allowed).not.toContain("*");
  }
});

test("preflight: cookie не разрешаем — Allow-Credentials не отдаётся", () => {
  const res = corsPreflight(request("capacitor://localhost", "OPTIONS"));
  expect(res.headers.has("access-control-allow-credentials")).toBe(false);
});

test("preflight: чужому origin и запросу без origin — 403 без заголовков CORS", () => {
  for (const origin of ["https://evil.example", "https://stariva.ru", null]) {
    const res = corsPreflight(request(origin, "OPTIONS"));
    expect(res.status).toBe(403);
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
    expect(res.headers.has("access-control-allow-headers")).toBe(false);
    expect(res.headers.get("vary")).toBe("Origin");
  }
});

test("ответ приложению: точный origin, set-auth-token открыт, тело цело", async () => {
  const res = withCors(
    request("https://localhost"),
    Response.json(
      { ok: true },
      {
        status: 201,
        headers: { "set-auth-token": "signed.token", vary: "Accept-Encoding" },
      },
    ),
  );
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ ok: true });
  expect(res.headers.get("access-control-allow-origin")).toBe(
    "https://localhost",
  );
  expect(res.headers.get("access-control-expose-headers")).toContain(
    "set-auth-token",
  );
  expect(res.headers.get("set-auth-token")).toBe("signed.token");
  expect(res.headers.get("vary")).toBe("Accept-Encoding, Origin");
  expect(res.headers.has("access-control-allow-credentials")).toBe(false);
});

test("ответ приложению: уже открытые заголовки не затираются", () => {
  const res = withCors(
    request("https://localhost"),
    new Response("ok", {
      headers: { "access-control-expose-headers": "X-Request-Id" },
    }),
  );
  const exposed = res.headers.get("access-control-expose-headers") ?? "";
  expect(exposed).toContain("x-request-id");
  expect(exposed).toContain("set-auth-token");
});

test("ответ своему сайту: CORS не добавляется, токен сессии скрыт", () => {
  for (const origin of ["https://stariva.ru", "https://evil.example", null]) {
    const res = withCors(
      request(origin),
      new Response("ok", {
        headers: {
          "set-auth-token": "signed.token",
          "access-control-expose-headers": "set-auth-token",
          "set-cookie": "better-auth.session_token=signed.token; HttpOnly",
        },
      }),
    );
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
    expect(res.headers.has("set-auth-token")).toBe(false);
    expect(
      res.headers.get("access-control-expose-headers") ?? "",
    ).not.toContain("set-auth-token");
    // cookie сайта остаётся как было
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("vary")).toBe("Origin");
  }
});

test("Vary: Origin не дублируется", () => {
  const res = withCors(
    request("https://localhost"),
    new Response("ok", { headers: { vary: "origin" } }),
  );
  expect(res.headers.get("vary")).toBe("origin");
});
