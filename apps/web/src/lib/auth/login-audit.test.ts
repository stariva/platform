import { describe, expect, test } from "bun:test";
import { loginMethodFromPath } from "./login-audit";

describe("loginMethodFromPath", () => {
  test("распознаёт способ входа по эндпоинту", () => {
    expect(loginMethodFromPath("/sign-in/email")).toBe("password");
    expect(loginMethodFromPath("/magic-link/verify")).toBe("magic_link");
    expect(loginMethodFromPath("/sign-in/email-otp")).toBe("email_otp");
    expect(loginMethodFromPath("/verify-email")).toBe("email_verification");
  });

  test("неизвестный путь и вызов с сервера — other", () => {
    expect(loginMethodFromPath("/something-else")).toBe("other");
    expect(loginMethodFromPath(undefined)).toBe("other");
  });
});
