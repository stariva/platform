import { timingSafeEqual } from "node:crypto";
import { COMMON_ERROR_STATUS_MAP, implement, ORPCError } from "@orpc/server";
import { env as baseEnv, logger } from "@stariva/config";
import {
  AdminNotConfiguredError,
  AttemptLostError,
  JobsNotConfiguredError,
  OzonNotConfiguredError,
  OzonRequestFailedError,
  PlaylistMissingError,
  type ReminderSweepResult,
  RemindersFailedError,
  StorageNotConfiguredError,
  webContract,
} from "./contract";
import { env } from "./env";

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
}

export function createWebORPCContext(opts: CreateWebORPCContextOptions) {
  return { headers: opts.headers, services: opts.services };
}

export type WebORPCContext = ReturnType<typeof createWebORPCContext>;

/**
 * HTTP-статусы для своих кодов ошибок: в v2 статус задаёт обработчик, а не
 * ошибка. Клиенты различают ошибки по коду, статус нужен логам и прокси.
 */
export const webErrorStatusMap = {
  ...COMMON_ERROR_STATUS_MAP,
  [JobsNotConfiguredError.code]: 503,
  [StorageNotConfiguredError.code]: 503,
  [AttemptLostError.code]: 409,
  [PlaylistMissingError.code]: 409,
  // Прогон не дослал часть уведомлений: воркер повторит его целиком
  [RemindersFailedError.code]: 500,
  [AdminNotConfiguredError.code]: 503,
  [OzonNotConfiguredError.code]: 503,
  [OzonRequestFailedError.code]: 502,
} satisfies Record<string, number>;

/** Коды ошибок, для которых у API витрины есть свой HTTP-статус. */
export type WebErrorCode = keyof typeof webErrorStatusMap;

function isWebErrorCode(code: string): code is WebErrorCode {
  return Object.hasOwn(webErrorStatusMap, code);
}

/** HTTP-статус ошибки с этим кодом; незнакомый код — 500, как у обработчика. */
export function webErrorStatus(code: string): number {
  return isWebErrorCode(code) ? webErrorStatusMap[code] : 500;
}

export const os = implement(webContract).$context<WebORPCContext>();

const timingMiddleware = os.middleware(async ({ next, path }) => {
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

/** Сверка `Authorization: Bearer <secret>` за постоянное время. */
function isBearerAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Доступ для воркера Hatchet: по общему JOBS_SECRET. */
const requireJobsSecret = os.middleware(async ({ context, next }) => {
  const secret = env.JOBS_SECRET;
  if (!secret) throw new JobsNotConfiguredError();
  if (!isBearerAuthorized(context.headers.get("authorization"), secret)) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next();
});

/** Доступ для админки: по общему REVALIDATE_SECRET. */
const requireAdminSecret = os.middleware(async ({ context, next }) => {
  const secret = baseEnv.REVALIDATE_SECRET;
  if (!secret) throw new AdminNotConfiguredError();
  if (!isBearerAuthorized(context.headers.get("authorization"), secret)) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next();
});

/**
 * Процедуры воркера и админки. Middleware висят на уровне поддерева, до
 * валидации входа: неавторизованный запрос отбивается, не доходя до схем.
 */
export const jobs = os.jobs.use(timingMiddleware).use(requireJobsSecret);
export const admin = os.admin.use(timingMiddleware).use(requireAdminSecret);
