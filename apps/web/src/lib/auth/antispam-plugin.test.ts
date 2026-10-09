import { expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { magicLink } from "better-auth/plugins";
import { antispam } from "./antispam-plugin";
import { FORM_TOKEN_HEADER } from "./form-token-shared";

// Настоящий better-auth на базе в памяти: проверяем плагин через HTTP-
// обработчик так же, как его вызывает браузер.
const SECRET = "t".repeat(40);
const ORIGIN = "http://localhost:3000";

function makeAuth(countRecentUnverified = async (_since: Date) => 0) {
  const sentVerification: string[] = [];
  const sentMagicLink: string[] = [];
  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: SECRET,
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    rateLimit: { enabled: false },
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user }) => {
        sentVerification.push(user.email);
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email }) => {
          sentMagicLink.push(email);
        },
      }),
      antispam({ countRecentUnverified }),
    ],
  });
  return { auth, sentVerification, sentMagicLink };
}

type TestAuth = ReturnType<typeof makeAuth>["auth"];

// Возраст токена считается по часам: выдаём его «давно», как будто форма
// открыта минуту назад.
async function oldToken(auth: TestAuth) {
  const { issueFormToken } = await import("./antispam");
  const { secret } = await auth.$context;
  return issueFormToken(secret, Date.now() - 60_000);
}

function post(path: string, body: unknown, token?: string | null) {
  return new Request(`${ORIGIN}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...(token ? { [FORM_TOKEN_HEADER]: token } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function errorOf(res: Response) {
  const json = (await res.json()) as { message?: string; code?: string };
  return { status: res.status, ...json };
}

const signUpBody = (email: string, name = "Анна Петрова") => ({
  email,
  name,
  password: "correct-horse-battery",
});

test("sign-up without a form token is rejected and sends nothing", async () => {
  const { auth, sentVerification } = makeAuth();
  const res = await auth.handler(post("/sign-up/email", signUpBody("a@x.ru")));
  expect(res.status).toBe(400);
  expect((await errorOf(res)).code).toBe("ANTISPAM");
  expect(sentVerification).toEqual([]);
});

test("sign-up with a fresh token is rejected as too fast", async () => {
  const { auth, sentVerification } = makeAuth();
  const { issueFormToken } = await import("./antispam");
  const { secret } = await auth.$context;
  const res = await auth.handler(
    post("/sign-up/email", signUpBody("a@x.ru"), issueFormToken(secret)),
  );
  expect(res.status).toBe(400);
  expect((await errorOf(res)).message).toContain("Слишком быстро");
  expect(sentVerification).toEqual([]);
});

test("a normal sign-up goes through and sends the verification email", async () => {
  const { auth, sentVerification } = makeAuth();
  const token = await oldToken(auth);
  const res = await auth.handler(
    post("/sign-up/email", signUpBody("anna@example.ru"), token),
  );
  expect(res.status).toBe(200);
  expect(sentVerification).toEqual(["anna@example.ru"]);
});

test("gibberish and empty names are rejected", async () => {
  const { auth, sentVerification } = makeAuth();
  const token = await oldToken(auth);
  for (const [i, name] of ["NNlWdMsPZXCIGdBXDKlbEmkZ", "  "].entries()) {
    const res = await auth.handler(
      post("/sign-up/email", signUpBody(`bot${i}@x.ru`, name), token),
    );
    expect(res.status).toBe(400);
  }
  expect(sentVerification).toEqual([]);
});

test("the same mailbox gets one email a minute, dots and +tags included", async () => {
  const { auth, sentVerification } = makeAuth();
  const token = await oldToken(auth);
  const first = await auth.handler(
    post("/sign-up/email", signUpBody("v.ictim@gmail.com"), token),
  );
  expect(first.status).toBe(200);
  const second = await auth.handler(
    post("/sign-up/email", signUpBody("victim+2@gmail.com"), token),
  );
  expect(second.status).toBe(429);
  expect(sentVerification).toEqual(["v.ictim@gmail.com"]);
});

test("sign-ups pause once the daily limit of unverified accounts is hit", async () => {
  const { auth, sentVerification } = makeAuth(async () => 100);
  const token = await oldToken(auth);
  const res = await auth.handler(
    post("/sign-up/email", signUpBody("late@example.ru"), token),
  );
  expect(res.status).toBe(503);
  expect(sentVerification).toEqual([]);
});

test("magic link needs a token; existing users bypass the daily limit", async () => {
  const { auth, sentMagicLink } = makeAuth(async () => 100);
  const token = await oldToken(auth);

  const noToken = await auth.handler(
    post("/sign-in/magic-link", { email: "new@example.ru" }),
  );
  expect(noToken.status).toBe(400);

  // Новый адрес при исчерпанном лимите — отказ
  const fresh = await auth.handler(
    post("/sign-in/magic-link", { email: "new@example.ru" }, token),
  );
  expect(fresh.status).toBe(503);

  // Уже существующий пользователь входит и при исчерпанном лимите
  const ctx = await auth.$context;
  await ctx.internalAdapter.createUser(
    { email: "old@example.ru", name: "Old", emailVerified: true },
    { method: "test" },
  );
  const existing = await auth.handler(
    post("/sign-in/magic-link", { email: "old@example.ru" }, token),
  );
  expect(existing.status).toBe(200);
  expect(sentMagicLink).toEqual(["old@example.ru"]);
});

test("password reset needs a token", async () => {
  const { auth } = makeAuth();
  const res = await auth.handler(
    post("/request-password-reset", { email: "a@x.ru" }),
  );
  expect(res.status).toBe(400);
});

test("server-side auth.api calls skip the checks (workshop checkout)", async () => {
  const { auth, sentMagicLink } = makeAuth();
  await auth.api.signInMagicLink({
    body: { email: "buyer@example.ru" },
    headers: new Headers({ origin: ORIGIN }),
  });
  expect(sentMagicLink).toEqual(["buyer@example.ru"]);
});
