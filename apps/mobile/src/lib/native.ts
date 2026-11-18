import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/** Web APIs работают в браузере и WebView; нативные плагины можно подключить здесь без изменения экранов. */
export const native = {
  haptic: () => {
    if (Capacitor.isNativePlatform() && "vibrate" in navigator)
      navigator.vibrate(12);
  },
  share: async (title: string, url: string) => {
    if (navigator.share) await navigator.share({ title, url });
    else if (navigator.clipboard) await navigator.clipboard.writeText(url);
  },
  openExternal: async (url: string) => {
    if (Capacitor.isNativePlatform()) await Browser.open({ url });
    else window.open(url, "_blank", "noopener,noreferrer");
  },
};
