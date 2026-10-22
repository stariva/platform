"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { stopPostHog } from "@/lib/analytics";
import {
  COOKIE_SETTINGS_EVENT,
  type CookieChoice,
  getCookieChoice,
  hasAnalyticsConsent,
  openCookieSettings,
  setCookieChoice,
} from "@/lib/cookie-consent";

/** Метрика (_ym*), пиксель VK (tmr_*) и PostHog (ph_*, __ph_*). */
const ANALYTICS_PREFIXES = ["_ym", "tmr_", "ph_", "__ph_"];
const isAnalyticsKey = (name: string) =>
  ANALYTICS_PREFIXES.some((prefix) => name.startsWith(prefix));

/** Удаляет cookie и записи в хранилище счётчиков после отзыва согласия. */
function clearAnalyticsStorage() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name || !isAnalyticsKey(name)) continue;
    for (const domain of domains) {
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API есть не во всех браузерах
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(storage)) {
        if (isAnalyticsKey(key)) storage.removeItem(key);
      }
    } catch {
      /* storage blocked */
    }
  }
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (getCookieChoice() === null) setOpen(true);
    const onSettings = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, onSettings);
  }, []);

  function choose(choice: CookieChoice) {
    const wasEnabled = hasAnalyticsConsent();
    setCookieChoice(choice);
    setOpen(false);
    if (choice === "denied" && wasEnabled) {
      // Загруженный счётчик нельзя выгрузить — чистим cookie и перезагружаем.
      stopPostHog();
      clearAnalyticsStorage();
      window.location.reload();
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Настройки cookie"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-xl rounded-2xl border border-espresso/10 bg-parchment p-3 sm:p-4 text-espresso shadow-lg"
    >
      {/* На телефоне — короче: баннер не должен закрывать четверть экрана.
          Запятая — внутри скрытой части, иначе на телефоне выходит «cookie,.». */}
      <p className="text-[12px] sm:text-[13px] leading-snug sm:leading-relaxed text-espresso/80">
        Мы используем cookie
        <span className="hidden sm:inline">
          , чтобы сайт работал и становился удобнее. Продолжая пользоваться
          сайтом, вы соглашаетесь с этим
        </span>
        .{" "}
        <Link
          href="/privacy-policy#cookies"
          className="text-terracotta underline-offset-2 hover:underline"
        >
          Подробнее
        </Link>
      </p>
      <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose("denied")}
          className="rounded-full border border-espresso/20 px-3 py-2 sm:py-2.5 min-h-10 sm:min-h-11 text-[12px] text-espresso hover:border-espresso/50 transition-colors"
        >
          Отказаться
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className="rounded-full bg-espresso px-3 py-2 sm:py-2.5 min-h-10 sm:min-h-11 text-[12px] text-parchment hover:bg-terracotta transition-colors"
        >
          Хорошо
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Настройки cookie
    </button>
  );
}
