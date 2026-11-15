import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import type { AppRelease } from "@stariva/web-api/contract";
import { api } from "@/lib/api";
import { decideUpdate, type UpdateStatus } from "@/lib/update-decision";

/** Работаем внутри оболочки; в браузере и Telegram-мини-приложении версию задаёт деплой сайта. */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Говорит плагину, что вшитый или только что поставленный бандл запустился.
 * Без этого вызова плагин через `appReadyTimeout` решит, что обновление
 * сломано, и откатится на предыдущий рабочий бандл. Звать как можно раньше
 * после старта интерфейса.
 */
export async function markAppReady(): Promise<void> {
  if (!isNativeApp) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error) {
    console.error("notifyAppReady", error);
  }
}

/** Версия работающего бандла: у вшитого плагин отвечает «builtin». */
function runningBundleVersion(pluginVersion: string): string {
  return pluginVersion === "builtin" ? __APP_VERSION__ : pluginVersion;
}

/**
 * Спрашивает сайт о последнем релизе и решает, что предложить. Бросает ошибку,
 * если сайт недоступен: ручная проверка покажет её, автоматическая промолчит.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!isNativeApp) return { kind: "none" };

  const [release, native, current, list] = await Promise.all([
    api.account.latestRelease(),
    App.getInfo(),
    CapacitorUpdater.current(),
    CapacitorUpdater.list(),
  ]);

  return decideUpdate({
    release,
    nativeVersion: native.version,
    bundleVersion: runningBundleVersion(current.bundle.version),
    failedVersions: new Set(
      list.bundles.filter((b) => b.status === "error").map((b) => b.version),
    ),
    platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
    iosStoreUrl: import.meta.env.VITE_IOS_STORE_URL,
  });
}

/**
 * Скачивает бандл релиза и переключается на него. `set` перезагружает
 * WebView, так что после успеха код дальше не выполняется. Если плагин не
 * дождётся `notifyAppReady` нового бандла, он сам вернётся на прежний.
 */
export async function installBundle(release: AppRelease): Promise<void> {
  const { bundles } = await CapacitorUpdater.list();
  // Бандл мог скачаться раньше, а переключение не случиться (оборвали связь)
  const downloaded = bundles.find(
    (b) => b.version === release.version && b.status === "pending",
  );
  const bundle =
    downloaded ??
    (await CapacitorUpdater.download({
      url: release.bundleZipUrl,
      version: release.version,
    }));
  await CapacitorUpdater.set({ id: bundle.id });
}

/** Ссылка на APK или страницу в магазине — в системном браузере. */
export async function openNativeUpdate(url: string): Promise<void> {
  await Browser.open({ url });
}

/** Следит за возвращением в приложение: тогда стоит перепроверить обновления. */
export async function onAppResume(handler: () => void): Promise<() => void> {
  if (!isNativeApp) return () => {};
  const listener = await App.addListener("resume", handler);
  return () => void listener.remove();
}
