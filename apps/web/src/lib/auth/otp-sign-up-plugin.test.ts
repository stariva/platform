import { expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { emailOTP } from "better-auth/plugins";
import { otpSignUp } from "./otp-sign-up-plugin";
import { PROFILE_REQUIRED } from "./sign-in-shared";

// Настоящий better-auth на базе в памяти, с теми же настройками emailOTP,
// что на витрине: код хранится хешем, пять попыток.
const SECRET = "t".repeat(40);
const ORIGIN = "http://localhost:3000";
const ATTEMPTS = 5;

function makeAuth() {
  const codes = new Map<string, string>();
  const db = {
    user: [] as Record<string, unknown>[],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: SECRET,
    database: memoryAdapter(db),
    rateLimit: { enabled: false },
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [
      emailOTP({
        storeOTP: "hashed",
        allowedAttempts: ATTEMPTS,
        sendVerificationOTP: async ({ email, otp }) => {
          codes.set(email, otp);
        },
      }),
      otpSignUp({ allowedAttempts: ATTEMPTS }),
    ],
  });
  return { auth, codes, db };
}

type TestAuth = ReturnType<typeof makeAuth>["auth"];

function post(path: string, body: unknown) {
  return new Request(`${ORIGIN}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

async function sendCode(auth: TestAuth, email: string) {
  const res = await auth.handler(
    post("/email-otp/send-verification-otp", { email, type: "sign-in" }),
  );
  expect(res.status).toBe(200);
}

async function signInWith(auth: TestAuth, body: Record<string, unknown>) {
  const res = await auth.handler(post("/sign-in/email-otp", body));
  const json = (await res.json()) as { code?: string; user?: unknown };
  return { status: res.status, ...json };
}

/** Заведомо неверный код той же длины. */
function wrong(code: string) {
  return code === "000000" ? "111111" : "000000";
}

test("right code for a new address asks for name and consent, keeps the code", async () => {
  const { auth, codes, db } = makeAuth();
  await sendCode(auth, "new@example.ru");
  const otp = codes.get("new@example.ru") as string;

  const first = await signInWith(auth, { email: "new@example.ru", otp });
  expect(first.status).toBe(400);
  expect(first.code).toBe(PROFILE_REQUIRED);
  expect(db.user).toHaveLength(0);

  // Тот же код подходит, когда пришли имя и согласие
  const second = await signInWith(auth, {
    email: "new@example.ru",
    otp,
    name: "Анна",
    personalDataConsent: true,
  });
  expect(second.status).toBe(200);
  expect(db.user).toHaveLength(1);
  expect(db.user[0]).toMatchObject({
    email: "new@example.ru",
    name: "Анна",
    emailVerified: true,
  });
  expect(db.user[0]).not.toHaveProperty("personalDataConsent");
});

test("consent without a name is not enough", async () => {
  const { auth, codes } = makeAuth();
  await sendCode(auth, "new@example.ru");
  const res = await signInWith(auth, {
    email: "new@example.ru",
    otp: codes.get("new@example.ru"),
    name: "  ",
    personalDataConsent: true,
  });
  expect(res.code).toBe(PROFILE_REQUIRED);
});

test("wrong code for a new address looks the same as for an existing one", async () => {
  const { auth, codes, db } = makeAuth();
  db.user.push({
    id: "u1",
    email: "old@example.ru",
    name: "Ольга",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await sendCode(auth, "new@example.ru");
  await sendCode(auth, "old@example.ru");

  const fresh = await signInWith(auth, {
    email: "new@example.ru",
    otp: wrong(codes.get("new@example.ru") as string),
  });
  const known = await signInWith(auth, {
    email: "old@example.ru",
    otp: wrong(codes.get("old@example.ru") as string),
  });
  expect(fresh.status).toBe(known.status);
  expect(fresh.code).toBe("INVALID_OTP");
  expect(known.code).toBe("INVALID_OTP");
});

test("existing account signs in with the code without any extra step", async () => {
  const { auth, codes, db } = makeAuth();
  db.user.push({
    id: "u1",
    email: "old@example.ru",
    name: "Ольга",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await sendCode(auth, "old@example.ru");
  const res = await signInWith(auth, {
    email: "old@example.ru",
    otp: codes.get("old@example.ru"),
  });
  expect(res.status).toBe(200);
});

test("the code burns after five wrong attempts", async () => {
  const { auth, codes } = makeAuth();
  await sendCode(auth, "new@example.ru");
  const otp = codes.get("new@example.ru") as string;
  for (let i = 0; i < ATTEMPTS; i++) {
    const res = await signInWith(auth, {
      email: "new@example.ru",
      otp: wrong(otp),
    });
    expect(res.code).toBe("INVALID_OTP");
  }
  const late = await signInWith(auth, {
    email: "new@example.ru",
    otp,
    name: "Анна",
    personalDataConsent: true,
  });
  expect(late.status).not.toBe(200);
  expect(late.code).not.toBe(PROFILE_REQUIRED);
});
