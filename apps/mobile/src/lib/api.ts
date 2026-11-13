import { createORPCClient, ORPCError, type StandardUrl } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";

/**
 * Адрес сайта. В браузере и в dev-режиме пусто: запросы идут на тот же адрес
 * (Vite проксирует /api). В Capacitor-оболочке задаётся `VITE_API_URL`.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "";

interface CallContext {
  /** Запрос должен уйти, даже если приложение сворачивают (прогресс). */
  keepalive?: boolean;
}

/** Типизированный клиент API сайта: тот же контракт, что у веб-кабинета. */
export const api: WebClient<CallContext> = createORPCClient(
  new RPCLink<CallContext>({
    // Без VITE_API_URL — путь на том же адресе (в dev его проксирует Vite)
    url: (API_URL
      ? new URL(WEB_RPC_PATH, API_URL).href
      : WEB_RPC_PATH) as StandardUrl,
    fetch: (url, init, { context }) =>
      fetch(url, {
        ...init,
        credentials: "include",
        keepalive: context.keepalive ?? false,
      }),
  }),
);

/** Ссылки на видео и файлы приходят путём сайта — делаем их полными. */
export function absoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${API_URL}${url}`;
}

/** Что показать зрителю, когда запрос не удался. */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ORPCError)) return fallback;
  if (error.code === "UNAUTHORIZED") return "Нужно войти в аккаунт";
  if (error.code === "FORBIDDEN") return "У вас нет доступа к этому курсу";
  return error.defined ? error.message : fallback;
}
