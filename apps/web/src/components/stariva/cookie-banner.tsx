"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_SETTINGS_EVENT,
  type CookieChoice,
  getCookieChoice,
  openCookieSettings,
  setCookieChoice,
} from "@/lib/cookie-consent";

/** Удаляет cookie Метрики (_ym_*) после отзыва согласия. */
function clearMetrikaCookies() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name?.startsWith("_ym")) continue;
    for (const domain of domains) {
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API есть не во всех браузерах
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
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
    const wasGranted = getCookieChoice() === "granted";
    setCookieChoice(choice);
    setOpen(false);
    if (choice === "denied" && wasGranted) {
      // Загруженный счётчик нельзя выгрузить — чистим cookie и перезагружаем.
      clearMetrikaCookies();
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
      <p className="text-[13px] leading-relaxed text-espresso/80">
        Cookie — для работы сайта. Яндекс.Метрика — только с вашего согласия.{" "}
        <Link
          href="/privacy-policy#cookies"
          className="text-terracotta underline-offset-2 hover:underline"
        >
          Подробнее
        </Link>
        .
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose("denied")}
          className="rounded-full border border-espresso/20 px-3 py-2.5 min-h-11 text-[12px] text-espresso hover:border-espresso/50 transition-colors"
        >
          Только необходимые
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className="rounded-full bg-espresso px-3 py-2.5 min-h-11 text-[12px] text-parchment hover:bg-terracotta transition-colors"
        >
          Разрешить аналитику
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
