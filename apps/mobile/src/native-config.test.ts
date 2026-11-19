import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import config from "../capacitor.config";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const gradle = read("android/app/build.gradle");
const pbxproj = read("ios/App/App.xcodeproj/project.pbxproj");

/** Значение, одинаковое во всех конфигурациях Xcode (Debug и Release). */
function xcodeSetting(name: string): string {
  const values = new Set(
    [...pbxproj.matchAll(new RegExp(`${name} = ([^;]+);`, "g"))].map((m) =>
      (m[1] ?? "").trim(),
    ),
  );
  expect([...values]).toHaveLength(1);
  return [...values][0] ?? "";
}

test("appId одинаков в Capacitor, Android и iOS", () => {
  const appId = config.appId ?? "";
  expect(appId).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);
  expect(gradle).toContain(`applicationId "${appId}"`);
  expect(gradle).toContain(`namespace = "${appId}"`);
  expect(xcodeSetting("PRODUCT_BUNDLE_IDENTIFIER")).toBe(appId);
});

test("версия и номер сборки оболочки совпадают на Android и iOS", () => {
  const versionName = /versionName "([^"]+)"/.exec(gradle)?.[1];
  const versionCode = /versionCode (\d+)/.exec(gradle)?.[1];
  expect(versionName ?? "").toMatch(/^\d+\.\d+\.\d+$/);
  expect(xcodeSetting("MARKETING_VERSION")).toBe(versionName ?? "");
  expect(xcodeSetting("CURRENT_PROJECT_VERSION")).toBe(versionCode ?? "");
});

test("Capgo в ручном режиме и без статистики в облако", () => {
  const updater = config.plugins?.CapacitorUpdater;
  expect(updater?.autoUpdate).toBe(false);
  expect(updater?.statsUrl).toBe("");
});

test("iOS: privacy-манифест лежит в проекте и подключён к сборке", () => {
  expect(pbxproj).toContain("PrivacyInfo.xcprivacy in Resources");
  expect(read("ios/App/App/PrivacyInfo.xcprivacy")).toContain(
    "NSPrivacyAccessedAPICategoryUserDefaults",
  );
  expect(read("ios/App/App/Info.plist")).toContain(
    "ITSAppUsesNonExemptEncryption",
  );
});
