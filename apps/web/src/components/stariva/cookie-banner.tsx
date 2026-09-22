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
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-espresso/10 bg-parchment p-5 text-espresso shadow-lg sm:bottom-5"
    >
      <p className="text-[13px] leading-relaxed text-espresso/80">
        Сайт использует необходимые cookie для работы корзины и входа в кабинет.
        С вашего согласия я также подключу Яндекс.Метрику, чтобы понимать, как
        улучшить сайт. Подробнее — в{" "}
        <Link
          href="/privacy-policy#cookies"
          className="text-terracotta underline-offset-2 hover:underline"
        >
          политике конфиденциальности
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => choose("denied")}
          className="rounded-full border border-espresso/20 px-5 py-2.5 text-[13px] text-espresso hover:border-espresso/50 transition-colors"
        >
          Только необходимые
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className="rounded-full bg-espresso px-5 py-2.5 text-[13px] text-parchment hover:bg-terracotta transition-colors"
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
