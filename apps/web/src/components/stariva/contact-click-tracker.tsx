"use client";

import { useEffect } from "react";
import { rememberEntry } from "@/lib/contact-clicks/entry";
import { handleContactClick } from "@/lib/contact-clicks/events";

/**
 * Журнал переходов в мессенджеры: запоминает, откуда начался заход, и ловит
 * клики по ссылкам к мастеру на всём сайте. Слушаем в фазе capture, чтобы
 * клик не потерялся, если компонент остановит всплытие.
 */
export function ContactClickTracker() {
  useEffect(() => {
    rememberEntry();
    document.addEventListener("click", handleContactClick, true);
    document.addEventListener("auxclick", handleContactClick, true);
    return () => {
      document.removeEventListener("click", handleContactClick, true);
      document.removeEventListener("auxclick", handleContactClick, true);
    };
  }, []);
  return null;
}
