import type { AppRelease } from "@stariva/web-api/contract";
import { meetsMinVersion } from "./version";

export type UpdateStatus =
  /** Стоит последняя версия (или обновляться нечем). */
  | { kind: "none" }
  /** Новый веб-бандл: скачивается и ставится прямо в приложении. */
  | { kind: "bundle"; release: AppRelease }
  /**
   * Оболочка старше `minNativeVersion` последнего релиза: бандл на ней не
   * запустится, нужна новая сборка. `url` — куда за ней идти (null — ссылки нет).
   */
  | { kind: "native"; release: AppRelease; url: string | null };

/**
 * Версия работающего бандла. Вшитый бандл плагин отдаёт с `id === "builtin"`, а
 * его `version` — это версия оболочки (versionName), не веб-бандла: тогда
 * берём версию, с которой собран сам бандл.
 */
export function runningBundleVersion(
  bundle: { id: string; version: string },
  builtinVersion: string,
): string {
  return bundle.id === "builtin" ? builtinVersion : bundle.version;
}

export interface DecisionInput {
  release: AppRelease | null;
  /** Версия нативной оболочки (versionName / MARKETING_VERSION). */
  nativeVersion: string;
  /** Версия работающего сейчас веб-бандла. */
  bundleVersion: string;
  /** Версии, которые на этом телефоне уже не запустились (откат плагина). */
  failedVersions: ReadonlySet<string>;
  platform: "android" | "ios";
  iosStoreUrl: string | undefined;
}

/**
 * Решает, что предложить пользователю. Без побочных эффектов: всё, что нужно,
 * приходит аргументами, поэтому каждую ветку проверяют тесты.
 */
export function decideUpdate(input: DecisionInput): UpdateStatus {
  const { release } = input;
  if (!release) return { kind: "none" };

  // Последняя оболочка слишком старая — бандл не ставим, просим новую сборку
  if (!meetsMinVersion(input.nativeVersion, release.minNativeVersion)) {
    const url =
      input.platform === "android"
        ? release.apkDownloadUrl
        : (input.iosStoreUrl ?? null);
    return { kind: "native", release, url };
  }

  // Уже стоит эта версия (релиз «последний» по номеру сборки, а не по semver,
  // поэтому и откат на меньшую версию — это тоже обновление)
  if (release.version === input.bundleVersion) return { kind: "none" };

  // Эта версия уже падала при запуске на этом телефоне. Не предлагаем её снова
  // по кругу: ждём следующий релиз
  if (input.failedVersions.has(release.version)) return { kind: "none" };

  // Без контрольной суммы Capgo бандл не скачает: не предлагаем то, что
  // заведомо не поставится (релиз выпущен в обход скрипта release)
  if (!release.bundleChecksum) return { kind: "none" };

  return { kind: "bundle", release };
}
