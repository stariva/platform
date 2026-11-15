import { expect, test } from "bun:test";
import { corsPreflight, withCors } from "@stariva/auth/cors";
import { MOBILE_APP_ORIGINS, trustedOriginsFor } from "@stariva/auth/origins";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer, emailOTP } from "better-auth/plugins";
import { issueFormToken } from "./antispam";
import { antispam } from "./antispam-plugin";
import { FORM_TOKEN_HEADER } from "./form-token-shared";
import { otpSignUp } from "./otp-sign-up-plugin";

// Настоящий better-auth на базе в памяти с теми же плагинами входа, что на
// витрине (emailOTP, otpSignUp, antispam, bearer): проверяем вход приложения
// целиком — от запроса кода до обращения к API с токеном.
const SECRET = "t".repeat(40);
const SITE = "https://stariva.ru";
const ANDROID = "https://localhost";
const IOS = "capacitor://localhost";
const ATTEMPTS = 5;

function makeAuth(extraTrusted: readonly string[] = MOBILE_APP_ORIGINS) {
  const codes = new Map<string, string>();
  const db = {
    user: [] as Record<string, unknown>[],
    session: [] as Record<string, unknown>[],
    account: [],
    verification: [],
  };
  db.user.push({
    id: "u1",
    email: "olga@example.ru",
    name: "Ольга",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const auth = betterAuth({
    baseURL: SITE,
    secret: SECRET,
    database: memoryAdapter(db),
    rateLimit: { enabled: false },
    // В тестах better-auth по умолчанию не проверяет origin; на проде проверяет
    advanced: { disableOriginCheck: false },
    trustedOrigins: trustedOriginsFor([SITE], extraTrusted),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [
      antispam({ countRecentUnverified: async () => 0 }),
      emailOTP({
        storeOTP: "hashed",
        allowedAttempts: ATTEMPTS,
        sendVerificationOTP: async ({ email, otp }) => {
          codes.set(email, otp);
        },
      }),
      otpSignUp({ allowedAttempts: ATTEMPTS }),
      bearer({ requireSignature: true }),
    ],
  });
  return { auth, codes, db };
}

type TestAuth = ReturnType<typeof makeAuth>["auth"];

/** Запрос так, как его шлёт приложение: чужой origin, без cookie. */
function call(
  path: string,
  init: { origin?: string; body?: unknown; token?: string; method?: string },
) {
  const headers: Record<string, string> = {};
  if (init.origin) headers.origin = init.origin;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  return new Request(`${SITE}/api/auth${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** То же, что делает route.ts: better-auth + CORS. */
async function handle(auth: TestAuth, request: Request) {
  return withCors(request, await auth.handler(request));
}

async function requestCode(auth: TestAuth, origin: string, email: string) {
  return handle(
    auth,
    new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        // Токен формы, выданный несколько секунд назад
        [FORM_TOKEN_HEADER]: issueFormToken(SECRET, Date.now() - 10_000),
      },
      body: JSON.stringify({ email, type: "sign-in" }),
    }),
  );
}

async function signIn(
  auth: TestAuth,
  codes: Map<string, string>,
  origin: string,
) {
  const sent = await requestCode(auth, origin, "olga@example.ru");
  expect(sent.status).toBe(200);
  return handle(
    auth,
    call("/sign-in/email-otp", {
      origin,
      body: { email: "olga@example.ru", otp: codes.get("olga@example.ru") },
    }),
  );
}

for (const origin of [ANDROID, IOS]) {
  test(`${origin}: вход по коду отдаёт токен сессии, и он открывает API`, async () => {
    const { auth, codes } = makeAuth();
    const res = await signIn(auth, codes, origin);
    expect(res.status).toBe(200);

    // CORS: точный origin, токен открыт для чтения, cookie не разрешены
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("access-control-expose-headers")).toContain(
      "set-auth-token",
    );
    expect(res.headers.has("access-control-allow-credentials")).toBe(false);

    const token = res.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    // Сессию по токену видит и эндпоинт better-auth, и серверный вызов,
    // которым пользуются процедуры /api/rpc (auth.api.getSession({ headers }))
    const viaEndpoint = await handle(
      auth,
      call("/get-session", { origin, token: token as string }),
    );
    expect(
      ((await viaEndpoint.json()) as { user: { id: string } }).user.id,
    ).toBe("u1");
    const viaApi = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
    });
    expect(viaApi?.user.id).toBe("u1");
  });
}

test("без токена сессии нет", async () => {
  const { auth } = makeAuth();
  expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  const res = await handle(auth, call("/get-session", { origin: ANDROID }));
  expect(await res.json()).toBeNull();
});

test("неподписанный токен (сырой id сессии) и чужая подпись не принимаются", async () => {
  const { auth, codes, db } = makeAuth();
  await signIn(auth, codes, ANDROID);
  const rawSessionToken = String(db.session[0]?.token);

  for (const bad of [
    rawSessionToken,
    `${rawSessionToken}.AAAA`,
    // верный id, подпись правильной длины, но не от нашего секрета
    `${rawSessionToken}.${"A".repeat(43)}=`,
    "",
  ]) {
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${bad}` }),
    });
    expect(session).toBeNull();
  }
});

test("выход гасит сессию: токен после него не работает", async () => {
  const { auth, codes } = makeAuth();
  const res = await signIn(auth, codes, ANDROID);
  const token = res.headers.get("set-auth-token") as string;

  const out = await handle(
    auth,
    call("/sign-out", { origin: ANDROID, token, body: {} }),
  );
  expect(out.status).toBe(200);
  expect(
    await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
    }),
  ).toBeNull();
});

test("запрос кода из приложения проходит проверку токена формы", async () => {
  const { auth } = makeAuth();
  const missing = await handle(
    auth,
    new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { origin: ANDROID, "content-type": "application/json" },
      body: JSON.stringify({ email: "olga@example.ru", type: "sign-in" }),
    }),
  );
  expect(missing.status).toBe(400);
  expect((await requestCode(auth, ANDROID, "olga@example.ru")).status).toBe(
    200,
  );
});

test("trustedOrigins: приложение доверено, чужой origin — нет", async () => {
  const { auth, codes } = makeAuth();
  // Для чужого origin вход отклоняется проверкой origin
  const sent = await requestCode(
    auth,
    "https://evil.example",
    "olga@example.ru",
  );
  expect(sent.status).toBe(403);
  expect(codes.size).toBe(0);
  const wrongPort = await requestCode(
    auth,
    "https://localhost:8443",
    // другой адрес: на один ящик письмо не чаще раза в минуту (antispam)
    "other@example.ru",
  );
  expect(wrongPort.status).toBe(403);
  const evilCode = await handle(
    auth,
    call("/sign-in/email-otp", {
      origin: "https://evil.example",
      body: { email: "olga@example.ru", otp: "123456" },
    }),
  );
  // Сам вход по коду origin не проверяет (без cookie подделывать нечего), но
  // чужому origin браузер ответ не отдаст: CORS-заголовков нет, токена тоже
  expect(evilCode.status).not.toBe(200);
  expect(evilCode.headers.has("access-control-allow-origin")).toBe(false);
  expect(evilCode.headers.has("set-auth-token")).toBe(false);
});

test("без extraTrustedOrigins приложению вход закрыт (поэтому они нужны)", async () => {
  const { auth } = makeAuth([]);
  const res = await requestCode(auth, ANDROID, "olga@example.ru");
  expect(res.status).toBe(403);
});

test("вход с самого сайта: токен сессии наружу не отдаётся", async () => {
  const { auth, codes } = makeAuth();
  const res = await signIn(auth, codes, SITE);
  expect(res.status).toBe(200);
  // cookie сессии есть, а читаемого из JS токена и CORS — нет
  expect(res.headers.get("set-cookie")).toContain("session_token");
  expect(res.headers.has("set-auth-token")).toBe(false);
  expect(res.headers.has("access-control-allow-origin")).toBe(false);
  expect(res.headers.get("access-control-expose-headers") ?? "").not.toContain(
    "set-auth-token",
  );
});

test("preflight на /api/auth из приложения разрешает Authorization и токен формы", () => {
  const res = corsPreflight(
    new Request(`${SITE}/api/auth/sign-in/email-otp`, {
      method: "OPTIONS",
      headers: {
        origin: ANDROID,
        "access-control-request-method": "POST",
        "access-control-request-headers": `authorization, content-type, ${FORM_TOKEN_HEADER}`,
      },
    }),
  );
  expect(res.status).toBe(204);
  const allowed = (res.headers.get("access-control-allow-headers") ?? "")
    .split(",")
    .map((h) => h.trim());
  for (const header of ["authorization", "content-type", FORM_TOKEN_HEADER]) {
    expect(allowed).toContain(header);
  }
});
