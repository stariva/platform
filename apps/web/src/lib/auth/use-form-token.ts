"use client";

import { useCallback, useEffect, useRef } from "react";
import { webApi } from "@/lib/web-api";
import { FORM_TOKEN_HEADER, FORM_TOKEN_REFRESH_MS } from "./form-token-shared";

/**
 * Забирает токен формы при открытии страницы и обновляет его, пока вкладка
 * открыта. `fetchOptions()` отдаёт заголовок для запроса better-auth; без
 * токена сервер откажет и попросит обновить страницу.
 */
export function useFormToken() {
  const token = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { token: issued } = await webApi.forms.formToken();
        if (active) token.current = issued;
      } catch {
        // Токена нет — сервер откажет в отправке, а пользователь обновит страницу.
      }
    }
    void load();
    const timer = setInterval(load, FORM_TOKEN_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return useCallback(
    () => ({
      headers: token.current ? { [FORM_TOKEN_HEADER]: token.current } : {},
    }),
    [],
  );
}
