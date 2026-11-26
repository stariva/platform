import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/** Web APIs работают в браузере и WebView; нативные плагины можно подключить здесь без изменения экранов. */
export const native = {
  onBackButton: async (handler: () => void) => {
    if (!Capacitor.isNativePlatform()) return () => {};
    const listener = await App.addListener("backButton", handler);
    return () => void listener.remove();
  },
  onResume: async (handler: () => void) => {
    if (!Capacitor.isNativePlatform()) return () => {};
    const listener = await App.addListener("resume", handler);
    return () => void listener.remove();
  },
  exitApp: async () => {
    if (Capacitor.isNativePlatform()) await App.exitApp();
  },
  haptic: () => {
    if (Capacitor.isNativePlatform() && "vibrate" in navigator)
      navigator.vibrate(12);
  },
  share: async (title: string, url: string) => {
    if (navigator.share) await navigator.share({ title, url });
    else if (navigator.clipboard) await navigator.clipboard.writeText(url);
  },
  openExternal: async (url: string) => {
    // mailto/tel внутри браузерного плагина не открываются: их разбирает сам
    // WebView и запускает системное приложение
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      window.location.href = url;
      return;
    }
    if (Capacitor.isNativePlatform()) await Browser.open({ url });
    else window.open(url, "_blank", "noopener,noreferrer");
  },
};
