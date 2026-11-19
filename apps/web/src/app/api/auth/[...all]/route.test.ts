import { expect, mock, test } from "bun:test";

// Подменяем better-auth: проверяем только то, что route.ts делает с CORS.
// Ответ — как у настоящего better-auth с bearer-плагином после входа.
const handler = mock(
  async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "set-auth-token": "signed.token",
        "access-control-expose-headers": "set-auth-token",
        "set-cookie": "better-auth.session_token=signed.token; HttpOnly",
      },
    }),
);
mock.module("server-only", () => ({}));
mock.module("@/lib/auth/server", () => ({ auth: { handler } }));

const { GET, OPTIONS, POST } = await import("./route");

const URL_ = "https://stariva.ru/api/auth/sign-in/email-otp";

test("OPTIONS из приложения: 204 с точным origin, без cookie", async () => {
  const res = await OPTIONS(
    new Request(URL_, {
      method: "OPTIONS",
      headers: {
        origin: "capacitor://localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-form-token",
      },
    }),
  );
  expect(res.status).toBe(204);
  expect(res.headers.get("access-control-allow-origin")).toBe(
    "capacitor://localhost",
  );
  expect(res.headers.has("access-control-allow-credentials")).toBe(false);
  // до better-auth preflight не доходит
  expect(handler).not.toHaveBeenCalled();
});

test("OPTIONS с чужого origin: 403", async () => {
  const res = await OPTIONS(
    new Request(URL_, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }),
  );
  expect(res.status).toBe(403);
  expect(res.headers.has("access-control-allow-origin")).toBe(false);
});

test("POST и GET из приложения: токен сессии открыт для чтения", async () => {
  for (const method of [POST, GET]) {
    const res = await method(
      new Request(URL_, {
        method: method === POST ? "POST" : "GET",
        headers: { origin: "https://localhost" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://localhost",
    );
    expect(res.headers.get("access-control-expose-headers")).toContain(
      "set-auth-token",
    );
    expect(res.headers.get("set-auth-token")).toBe("signed.token");
    expect(await res.json()).toEqual({ ok: true });
  }
});

test("POST со своего сайта: cookie как были, токен и CORS не отдаются", async () => {
  const res = await POST(
    new Request(URL_, {
      method: "POST",
      headers: { origin: "https://stariva.ru" },
    }),
  );
  expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  expect(res.headers.has("set-auth-token")).toBe(false);
  expect(res.headers.has("access-control-allow-origin")).toBe(false);
});
