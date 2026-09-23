"use client";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_EVENT, getCookieChoice } from "@/lib/cookie-consent";
import { TelegramIcon } from "./icons";

export function MobileStickyBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const update = () => {
      const editing = document.activeElement?.matches("input,textarea,select");
      setShow(window.scrollY > 450 && getCookieChoice() !== null && !editing);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener(COOKIE_CONSENT_EVENT, update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener(COOKIE_CONSENT_EVENT, update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  if (!show) return null;
  return (
    <div className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50">
      <div className="bg-parchment/95 backdrop-blur-md border border-espresso/15 rounded-full p-1.5 shadow-lg flex gap-2">
        <a
          href="/#order"
          data-location="mobile_bar"
          className="flex-[1.4] flex items-center justify-center min-h-12 px-3 rounded-full bg-terracotta text-parchment text-sm font-medium"
        >
          Получить расчёт
        </a>
        <a
          href="https://t.me/Olga_Stariva"
          data-location="mobile_bar"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 min-h-12 px-3 rounded-full border border-espresso/20 text-espresso text-sm"
        >
          <TelegramIcon className="w-4 h-4" />
          Telegram
        </a>
      </div>
    </div>
  );
}
