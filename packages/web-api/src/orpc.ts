import { implement } from "@orpc/server";
import type { Session } from "@stariva/auth";
import { logger } from "@stariva/config";
import {
  type CustomOrderRequest,
  type LessonVideoResult,
  type MaterialUrlResult,
  type ReminderSweepResult,
  webContract,
} from "./contract";

/**
 * Логика, которая пока живёт в витрине и тянет за собой её модули (письма,
 * Telegram, заказы). Витрина передаёт её в контекст, процедуры только зовут.
 */
export interface WebServices {
  /** Рассылка о мастер-классах: apps/web/src/lib/workshops/notifications.ts */
  runWorkshopReminderSweep: () => Promise<ReminderSweepResult>;
  /** Токен антиспама для форм входа: секрет better-auth живёт в витрине. */
  issueFormToken: () => Promise<string>;
  /** Уведомление мастеру о подписке: apps/web/src/lib/newsletter.ts */
  subscribeToNewsletter: (email: string, source?: string) => Promise<void>;
  customOrders: CustomOrderServices;
  workshopFiles: WorkshopFileServices;
  /** Сброс кэша страниц Next: revalidatePath живёт в витрине. */
  revalidatePaths: (paths: string[]) => void;
}

/**
 * Видео и файлы мастер-классов: каталог курсов, журнал просмотров и подпись
 * HLS-пропуска живут в витрине (apps/web/src/lib/workshops/signed-media.ts).
 */
export interface WorkshopFileServices {
  /**
   * Ссылка на видео урока. Заголовки нужны для IP, user-agent и cookie
   * сессии, к которой привязан HLS-пропуск.
   */
  signLessonVideo: (input: {
    slug: string;
    lessonId: string;
    userId: string | null;
    headers: Headers;
  }) => Promise<LessonVideoResult>;
  /** Ссылка на PDF-материал курса. */
  signMaterial: (input: {
    slug: string;
    key: string;
    userId: string | null;
  }) => Promise<MaterialUrlResult>;
}

/** Заявки на изделия: apps/web/src/lib/custom-order */
export interface CustomOrderServices {
  /** Есть ли куда доставить уведомление о заявке (Telegram или почта). */
  isAccepting: () => boolean;
  /**
   * Сохраняет заявку и фото. Визитёра и рекламный источник витрина берёт из
   * заголовков запроса. `"conflict"` — повтор с тем же requestId, но другими
   * данными.
   */
  save: (
    request: CustomOrderRequest,
    photo: File | null,
    headers: Headers,
  ) => Promise<{ id: string; number: number } | "conflict">;
  /** Отправляет уведомление уже после ответа посетителю. */
  dispatchLater: (id: string) => void;
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
