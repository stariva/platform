import { implement } from "@orpc/server";
import type { Session } from "@stariva/auth";
import { logger } from "@stariva/config";
import { type ReminderSweepResult, webContract } from "./contract";

/**
 * Логика, которая пока живёт в витрине и тянет за собой её модули (письма,
 * Telegram, заказы). Витрина передаёт её в контекст, процедуры только зовут.
 */
export interface WebServices {
  /** Рассылка о мастер-классах: apps/web/src/lib/workshops/notifications.ts */
  runWorkshopReminderSweep: () => Promise<ReminderSweepResult>;
}

export interface CreateWebORPCContextOptions {
  /** Заголовки запроса: по ним процедуры проверяют доступ. */
  headers: Headers;
  services: WebServices;
  /**
   * Сессия покупателя. Экземпляр better-auth живёт в витрине, поэтому она
   * передаёт загрузчик, а не готовую сессию: его зовут только процедуры
   * покупателя, вызовы воркера и админки в базу за сессией не ходят.
   */
  getSession: () => Promise<Session | null>;
}

export function createWebORPCContext(opts: CreateWebORPCContextOptions) {
  return {
    headers: opts.headers,
    services: opts.services,
    getSession: opts.getSession,
  };
}

export type WebORPCContext = ReturnType<typeof createWebORPCContext>;

export const os = implement(webContract).$context<WebORPCContext>();

export const timingMiddleware = os.middleware(async ({ next, path }) => {
  const start = Date.now();
  try {
    return await next();
  } finally {
    logger.info("web_orpc.request", {
      path: path.join("."),
      durationMs: Date.now() - start,
    });
  }
});
