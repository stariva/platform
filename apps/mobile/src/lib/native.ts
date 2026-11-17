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
  calendarUrl: (
    title: string,
    startsAt: string,
    endsAt: string,
    details: string,
  ) => {
    const format = (value: string) =>
      new Date(value)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${format(startsAt)}/${format(endsAt)}&details=${encodeURIComponent(details)}`;
  },
};
