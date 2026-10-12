"use client";

import { useEffect } from "react";

const COOKIE = "stariva_env"; // как VISITOR_ENV_COOKIE в lib/visitor.ts
const MAX_AGE = 30 * 24 * 60 * 60; // секунды

/**
 * Записывает в first-party cookie то, что видит только браузер: часовой
 * пояс, экран, язык. Сервер читает её при оформлении заказа или заявки.
 */
export function VisitorEnv() {
  useEffect(() => {
    try {
      const value = JSON.stringify({
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        scr: `${screen.width}x${screen.height}`,
        vp: `${window.innerWidth}x${window.innerHeight}`,
        dpr: window.devicePixelRatio,
        lang: navigator.language,
        langs: navigator.languages?.join(",").slice(0, 200),
      });
      const secure = location.protocol === "https:" ? "; Secure" : "";
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API есть не во всех браузерах
      document.cookie = `${COOKIE}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch {
      /* Cookie заблокированы — сервер обойдётся заголовками. */
    }
  }, []);
  return null;
}
