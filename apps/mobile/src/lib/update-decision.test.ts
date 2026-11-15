import { describe, expect, test } from "bun:test";
import type { AppRelease } from "@stariva/web-api/contract";
import { type DecisionInput, decideUpdate } from "./update-decision";

const release: AppRelease = {
  version: "1.4.0",
  bundleZipUrl: "https://cdn.example/mobile/bundles/1.4.0.zip",
  minNativeVersion: "1.2.0",
  apkDownloadUrl: "https://cdn.example/mobile/apk/stariva-1.2.0.apk",
  releaseNotes: "",
};

function input(patch: Partial<DecisionInput> = {}): DecisionInput {
  return {
    release,
    nativeVersion: "1.2.0",
    bundleVersion: "1.3.0",
    failedVersions: new Set(),
    platform: "android",
    iosStoreUrl: "https://apps.apple.com/app/id1",
    ...patch,
  };
}

describe("decideUpdate", () => {
  test("релизов ещё не было — обновлять нечем", () => {
    expect(decideUpdate(input({ release: null }))).toEqual({ kind: "none" });
  });

  test("новый бандл на подходящей оболочке — ставим в приложении", () => {
    expect(decideUpdate(input())).toEqual({ kind: "bundle", release });
  });

  test("уже стоит последняя версия — ничего не предлагаем", () => {
    expect(decideUpdate(input({ bundleVersion: "1.4.0" }))).toEqual({
      kind: "none",
    });
  });

  test("откат на меньшую версию тоже считается обновлением", () => {
    const rollback = { ...release, version: "1.1.0" };
    expect(
      decideUpdate(input({ release: rollback, bundleVersion: "1.3.0" })),
    ).toEqual({ kind: "bundle", release: rollback });
  });

  test("оболочка старше minNativeVersion: Android ведёт на APK", () => {
    expect(decideUpdate(input({ nativeVersion: "1.1.0" }))).toEqual({
      kind: "native",
      release,
      url: release.apkDownloadUrl,
    });
  });

  test("оболочка старше minNativeVersion: iOS ведёт в App Store", () => {
    expect(
      decideUpdate(input({ nativeVersion: "1.1.0", platform: "ios" })),
    ).toEqual({
      kind: "native",
      release,
      url: "https://apps.apple.com/app/id1",
    });
  });

  test("старая оболочка и нет ссылки — просим обновиться без кнопки", () => {
    expect(
      decideUpdate(
        input({
          nativeVersion: "1.1.0",
          release: { ...release, apkDownloadUrl: null },
        }),
      ),
    ).toMatchObject({ kind: "native", url: null });
    expect(
      decideUpdate(
        input({
          nativeVersion: "1.1.0",
          platform: "ios",
          iosStoreUrl: undefined,
        }),
      ),
    ).toMatchObject({ kind: "native", url: null });
  });

  test("при старой оболочке бандл не ставится, даже если он новее", () => {
    expect(
      decideUpdate(input({ nativeVersion: "1.0.0", bundleVersion: "1.0.0" })),
    ).toMatchObject({ kind: "native" });
  });

  test("версия, что уже откатывалась на этом телефоне, не предлагается снова", () => {
    expect(decideUpdate(input({ failedVersions: new Set(["1.4.0"]) }))).toEqual(
      { kind: "none" },
    );
  });
});
