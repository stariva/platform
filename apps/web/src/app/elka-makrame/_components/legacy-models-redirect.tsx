"use client";

import { useEffect } from "react";
import { TREES_PATH } from "@/app/elka-makrame-na-stenu/_data";
import { LEGACY_MODELS_HASH } from "../_data";

/**
 * /elka-makrame#models — старый адрес витрины готовых ёлок. Якорь до сервера
 * не доходит, поэтому уводим на новую страницу из браузера, без записи в
 * истории: «назад» не вернёт на мастер-класс.
 */
export function LegacyModelsRedirect() {
  useEffect(() => {
    if (window.location.hash !== LEGACY_MODELS_HASH) return;
    const url = new URL(TREES_PATH, window.location.origin);
    // UTM из старых объявлений не теряем.
    url.search = window.location.search;
    url.hash = LEGACY_MODELS_HASH;
    window.location.replace(url);
  }, []);
  return null;
}
