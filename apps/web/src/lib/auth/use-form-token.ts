"use client";

import { useCallback, useEffect, useRef } from "react";
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
        const res = await fetch("/api/form-token", { cache: "no-store" });
        if (!res.ok) return;
        const data: { token?: string } = await res.json();
        if (active && data.token) token.current = data.token;
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
