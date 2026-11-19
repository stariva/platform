import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaSignInCodeEmail, {
  signInCodeSubject,
} from "./emails/stariva-sign-in-code";

test("subject starts with the code so it shows in the phone notification", () => {
  expect(signInCodeSubject("482719")).toBe("482719 — код для входа в Stariva");
});

test("existing account gets the code and a sign-in button", async () => {
  const url = "https://stariva.ru/api/auth/magic-link/verify?token=abc";
  const html = await render(StarivaSignInCodeEmail({ otp: "482719", url }));
  expect(html).toContain("482 719");
  expect(html).toContain("Войти без кода");
  expect(html).toContain(`href="${url}"`);
  expect(html).toContain("Действует 10 минут");
});

test("new address gets only the code, without a button or link", async () => {
  const html = await render(
    StarivaSignInCodeEmail({ otp: "482719", isNewUser: true }),
  );
  expect(html).toContain("482 719");
  expect(html).toContain("создадим ваш личный кабинет");
  expect(html).not.toContain("Войти без кода");
  expect(html).not.toContain("скопируйте ссылку");
});
