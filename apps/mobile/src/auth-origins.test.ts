import { expect, test } from "bun:test";
import { MOBILE_APP_ORIGINS } from "@stariva/auth/origins";
import config from "../capacitor.config";

/**
 * Сайт пускает приложение по точному списку origin'ов (CORS и better-auth
 * trustedOrigins). Он должен совпадать с тем, как оболочка открывает бандл.
 */

test("Android открывает бандл как <androidScheme>://localhost", () => {
  const scheme = config.server?.androidScheme;
  expect(scheme).toBe("https");
  expect(MOBILE_APP_ORIGINS).toContain(`${scheme}://localhost`);
});

test("iOS открывает бандл как capacitor://localhost (схема по умолчанию)", () => {
  // iosScheme в конфиге не задан — значит, Capacitor использует capacitor://
  expect(config.server?.iosScheme).toBeUndefined();
  expect(MOBILE_APP_ORIGINS).toContain("capacitor://localhost");
});

test("в списке сайта нет ничего лишнего (нет hostname-переопределения)", () => {
  expect(config.server?.hostname).toBeUndefined();
  expect(config.server?.url).toBeUndefined();
  expect(MOBILE_APP_ORIGINS).toHaveLength(2);
});
