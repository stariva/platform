import { expect, test } from "bun:test";
import {
  canonicalEmail,
  checkFormToken,
  createCooldown,
  issueFormToken,
  looksLikeGibberishName,
} from "./antispam";
import { safeCallbackPath, verificationPageUrl } from "./verification-link";

const SECRET = "s".repeat(40);
const T0 = Date.UTC(2026, 9, 9, 12, 0, 0);

test("a form token is accepted once the form could have been filled", () => {
  const token = issueFormToken(SECRET, T0);
  expect(checkFormToken(token, SECRET, T0 + 5_000)).toBe("ok");
  expect(checkFormToken(token, SECRET, T0 + 60 * 60 * 1000)).toBe("ok");
});

test("a form token submitted instantly is rejected as too fast", () => {
  const token = issueFormToken(SECRET, T0);
  expect(checkFormToken(token, SECRET, T0)).toBe("too-fast");
  expect(checkFormToken(token, SECRET, T0 + 1_000)).toBe("too-fast");
});

test("a form token expires", () => {
  const token = issueFormToken(SECRET, T0);
  expect(checkFormToken(token, SECRET, T0 + 3 * 60 * 60 * 1000)).toBe(
    "expired",
  );
});

test("missing, malformed, forged and foreign-secret tokens are rejected", () => {
  const now = T0 + 10_000;
  const token = issueFormToken(SECRET, T0);
  const [issuedAt = "", signature = ""] = token.split(".");

  expect(checkFormToken(null, SECRET, now)).toBe("missing");
  expect(checkFormToken("", SECRET, now)).toBe("missing");
  expect(checkFormToken("garbage", SECRET, now)).toBe("invalid");
  expect(checkFormToken(`${issuedAt}.`, SECRET, now)).toBe("invalid");
  expect(checkFormToken(`${issuedAt}.${signature}x`, SECRET, now)).toBe(
    "invalid",
  );
  // Подделка времени выдачи при чужой подписи
  expect(checkFormToken(`1.${signature}`, SECRET, now)).toBe("invalid");
  expect(checkFormToken(token, "o".repeat(40), now)).toBe("invalid");
});

test("random-case bot names are flagged", () => {
  for (const name of [
    "NNlWdMsPZXCIGdBXDKlbEmkZ",
    "psGSixYcbgGrUeoUaxJG",
    "cKTJJUbtmFpJvpJX",
    "mrfRIruYxPXCkuMJSHXpqie",
    "OQXSouaovnoUczRGzP",
    "FSSteuUnpsEEYdUUSOJMvv",
    "pgjggBtkhHIXTYqFDAYfLkdd",
    "sbEImZsOEocgmcHCRmr",
    "pgJJqutuzklKDDVG",
    "QswiTejfqesrvoFX",
  ]) {
    expect(looksLikeGibberishName(name)).toBe(true);
  }
});

test("real names are not flagged", () => {
  for (const name of [
    "Мария",
    "Анна Петрова",
    "Maksim Карпычев",
    "Anna-Maria",
    "McDonald",
    "DeShawn Washington",
    "LaToya",
    "JoAnn McKenzie",
    "Christopher",
    "MacGregor",
    "Mary-Kate McKenzie",
    "x",
    "",
  ]) {
    expect(looksLikeGibberishName(name)).toBe(false);
  }
});

test("gmail dots, plus tags and googlemail collapse to one mailbox", () => {
  expect(canonicalEmail("A.b.C+shop@Gmail.com")).toBe("abc@gmail.com");
  expect(canonicalEmail("abc@googlemail.com")).toBe("abc@gmail.com");
  expect(canonicalEmail(" a.b@yahoo.com ")).toBe("a.b@yahoo.com");
  expect(canonicalEmail("user+tag@example.org")).toBe("user@example.org");
  expect(canonicalEmail("+tag@example.org")).toBe("+tag@example.org");
  expect(canonicalEmail("not-an-email")).toBe("not-an-email");
});

test("cooldown lets one request per key through per window", () => {
  const cooldown = createCooldown(60_000);
  expect(cooldown.take("a@x.ru", T0)).toBe(0);
  expect(cooldown.take("a@x.ru", T0 + 10_000)).toBe(50_000);
  expect(cooldown.take("b@x.ru", T0 + 10_000)).toBe(0);
  expect(cooldown.take("a@x.ru", T0 + 60_000)).toBe(0);
});

test("a rejected request does not extend the cooldown", () => {
  const cooldown = createCooldown(60_000);
  cooldown.take("a@x.ru", T0);
  cooldown.take("a@x.ru", T0 + 30_000);
  expect(cooldown.take("a@x.ru", T0 + 60_000)).toBe(0);
});

test("cooldown memory stays bounded", () => {
  const cooldown = createCooldown(60_000, 3);
  for (let i = 0; i < 10; i++) cooldown.take(`k${i}`, T0 + i);
  // Самый старый ключ вытеснен, свежий всё ещё на паузе
  expect(cooldown.take("k0", T0 + 20)).toBe(0);
  expect(cooldown.take("k9", T0 + 21)).toBeGreaterThan(0);
});

test("verification link points to the confirm page, not the API", () => {
  const apiUrl =
    "https://stariva.ru/api/auth/verify-email?token=abc.def&callbackURL=%2Faccount";
  expect(verificationPageUrl(apiUrl)).toBe(
    "https://stariva.ru/verify-email?token=abc.def&callbackURL=%2Faccount",
  );
  expect(verificationPageUrl("https://stariva.ru/some/other")).toBe(
    "https://stariva.ru/some/other",
  );
});

test("callback path after confirmation stays on the site", () => {
  expect(safeCallbackPath(null)).toBe("/account");
  expect(safeCallbackPath("/account/profile")).toBe("/account/profile");
  expect(safeCallbackPath("//evil.example")).toBe("/account");
  expect(safeCallbackPath("https://evil.example")).toBe("/account");
  expect(safeCallbackPath("/\\evil.example")).toBe("/account");
});
