import { expect, test } from "bun:test";
import { createAuthClient, FORM_TOKEN_MIN_AGE_MS } from "./auth-client";
import { createTokenStore, type KeyValueStorage } from "./token-store";

const SITE = "https://stariva.ru";

function setup(
  handler: (request: Request) => Response | Promise<Response>,
  opts: { token?: string } = {},
) {
  const data = new Map<string, string>(
    opts.token ? [["stariva.session-token", opts.token]] : [],
  );
  const storage: KeyValueStorage = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
  const tokens = createTokenStore(storage);
  const requests: Request[] = [];
  // Bun не хранит credentials в Request — смотрим на то, что передали в fetch
  const inits: RequestInit[] = [];
  const waits: number[] = [];
  let clock = 1_000_000;
  let formTokens = 0;
  const client = createAuthClient({
    baseUrl: SITE,
    tokens,
    fetchFormToken: async () => `form-${++formTokens}`,
    fetch: (async (url: string, init: RequestInit) => {
      const request = new Request(url, init);
      requests.push(request);
      inits.push(init);
      return handler(request);
    }) as unknown as typeof fetch,
    now: () => clock,
    wait: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
  });
  return {
    client,
    tokens,
    requests,
    inits,
    waits,
    data,
    advance: (ms: number) => void (clock += ms),
  };
}

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

test("запрос кода: токен формы, без cookie, на /api/auth сайта", async () => {
  const { client, requests, inits, waits } = setup(() =>
    json({ success: true }),
  );
  expect(await client.requestCode("olga@mail.ru")).toEqual({ ok: true });

  const [request] = requests;
  expect(request?.url).toBe(`${SITE}/api/auth/email-otp/send-verification-otp`);
  expect(request?.method).toBe("POST");
  expect(inits[0]?.credentials).toBe("omit");
  expect(request?.headers.get("x-form-token")).toBe("form-1");
  expect(request?.headers.get("authorization")).toBeNull();
  expect(await request?.json()).toEqual({
    email: "olga@mail.ru",
    type: "sign-in",
  });
  // токен формы только что выдан — ждём, пока он «созреет» на сервере
  expect(waits).toEqual([FORM_TOKEN_MIN_AGE_MS]);
});

test("созревший токен формы не заставляет ждать", async () => {
  const { client, waits, advance } = setup(() => json({ success: true }));
  await client.prepareFormToken();
  advance(FORM_TOKEN_MIN_AGE_MS + 1);
  await client.requestCode("olga@mail.ru");
  expect(waits).toEqual([]);
});

test("токен формы устарел на сервере — берём новый и пробуем ещё раз", async () => {
  let calls = 0;
  const { client, requests } = setup(() =>
    ++calls === 1
      ? json(
          {
            code: "ANTISPAM",
            message: "Страница устарела. Обновите страницу.",
          },
          { status: 400 },
        )
      : json({ success: true }),
  );
  expect(await client.requestCode("olga@mail.ru")).toEqual({ ok: true });
  expect(requests.map((r) => r.headers.get("x-form-token"))).toEqual([
    "form-1",
    "form-2",
  ]);
});

test("ошибки сервера показываются по-русски, сети нет — понятный текст", async () => {
  const cooldown = setup(() =>
    json(
      {
        code: "ANTISPAM",
        message:
          "Письмо на этот адрес уже отправлено. Проверьте почту или повторите через минуту.",
      },
      { status: 429 },
    ),
  );
  const res = await cooldown.client.requestCode("olga@mail.ru");
  expect(res).toEqual({
    ok: false,
    message: expect.stringContaining("уже отправлено"),
  });

  const offline = setup(() => {
    throw new TypeError("Failed to fetch");
  });
  const down = await offline.client.requestCode("olga@mail.ru");
  expect(down.ok).toBe(false);
  expect(down.ok === false && down.message).toContain("Нет связи");
});

test("вход по коду сохраняет токен из set-auth-token", async () => {
  const { client, tokens, requests, inits } = setup(() =>
    json(
      { user: { id: "u1", email: "olga@mail.ru", name: "Ольга" } },
      { headers: { "set-auth-token": "id.signature" } },
    ),
  );
  const result = await client.signInWithCode("olga@mail.ru", "123456");
  expect(result).toEqual({
    ok: true,
    user: { id: "u1", email: "olga@mail.ru", name: "Ольга" },
  });
  expect(await tokens.get()).toBe("id.signature");
  expect(requests[0]?.url).toBe(`${SITE}/api/auth/sign-in/email-otp`);
  expect(inits[0]?.credentials).toBe("omit");
  expect(await requests[0]?.json()).toEqual({
    email: "olga@mail.ru",
    otp: "123456",
  });
});

test("вход без токена в ответе — ошибка, а не «вошли»", async () => {
  const { client, tokens } = setup(() => json({ user: { id: "u1" } }));
  const result = await client.signInWithCode("olga@mail.ru", "123456");
  expect(result.ok).toBe(false);
  expect(await tokens.get()).toBeNull();
});

test("неверный код и устаревший код — русские тексты, токена нет", async () => {
  const wrong = setup(() =>
    json({ code: "INVALID_OTP", message: "Invalid OTP" }, { status: 400 }),
  );
  expect(await wrong.client.signInWithCode("olga@mail.ru", "000000")).toEqual({
    ok: false,
    code: "INVALID_OTP",
    message: "Неверный код.",
  });
  expect(await wrong.tokens.get()).toBeNull();

  const late = setup(() =>
    json({ code: "OTP_EXPIRED", message: "OTP expired" }, { status: 400 }),
  );
  const res = await late.client.signInWithCode("olga@mail.ru", "000000");
  expect(res.ok === false && res.message).toContain("устарел");
});

test("код верный, а аккаунта нет — отправляем на сайт, регистрации в приложении нет", async () => {
  const { client, tokens } = setup(() =>
    json({ code: "PROFILE_REQUIRED", message: "..." }, { status: 400 }),
  );
  const res = await client.signInWithCode("new@mail.ru", "123456");
  expect(res.ok).toBe(false);
  expect(res.ok === false && res.message).toContain("stariva.ru");
  expect(await tokens.get()).toBeNull();
});

test("проверка сессии шлёт Bearer без cookie", async () => {
  const { client, requests, inits } = setup(
    () => json({ user: { id: "u1", email: "o@m.ru", name: "О" }, session: {} }),
    { token: "id.signature" },
  );
  expect(await client.checkSession()).toEqual({
    status: "signed-in",
    user: { id: "u1", email: "o@m.ru", name: "О" },
  });
  expect(requests[0]?.url).toBe(`${SITE}/api/auth/get-session`);
  expect(requests[0]?.headers.get("authorization")).toBe("Bearer id.signature");
  expect(inits[0]?.credentials).toBe("omit");
});

test("без токена сессии не спрашиваем сервер", async () => {
  const { client, requests } = setup(() => json(null));
  expect(await client.checkSession()).toEqual({ status: "signed-out" });
  expect(requests).toHaveLength(0);
});

test("сервер не узнал токен — разлогиниваем и стираем его", async () => {
  for (const response of [
    () => json(null),
    () => json({ message: "Unauthorized" }, { status: 401 }),
  ]) {
    const { client, tokens } = setup(response, { token: "id.signature" });
    expect(await client.checkSession()).toEqual({ status: "signed-out" });
    expect(await tokens.get()).toBeNull();
  }
});

test("сервер или сеть недоступны — токен остаётся, из аккаунта не выбрасываем", async () => {
  const down = setup(
    () => {
      throw new TypeError("Failed to fetch");
    },
    { token: "id.signature" },
  );
  expect(await down.client.checkSession()).toEqual({ status: "unknown" });
  expect(await down.tokens.get()).toBe("id.signature");

  const broken = setup(() => new Response("bad gateway", { status: 502 }), {
    token: "id.signature",
  });
  expect(await broken.client.checkSession()).toEqual({ status: "unknown" });
  expect(await broken.tokens.get()).toBe("id.signature");
});

test("выход гасит сессию на сервере и стирает токен, даже если сети нет", async () => {
  const online = setup(() => json({ success: true }), {
    token: "id.signature",
  });
  await online.client.signOut();
  expect(online.requests[0]?.url).toBe(`${SITE}/api/auth/sign-out`);
  expect(online.requests[0]?.headers.get("authorization")).toBe(
    "Bearer id.signature",
  );
  expect(await online.tokens.get()).toBeNull();

  const offline = setup(
    () => {
      throw new TypeError("Failed to fetch");
    },
    { token: "id.signature" },
  );
  await offline.client.signOut();
  expect(await offline.tokens.get()).toBeNull();
});
