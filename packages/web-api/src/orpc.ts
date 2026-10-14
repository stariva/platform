import { timingSafeEqual } from "node:crypto";
import { COMMON_ERROR_STATUS_MAP, implement, ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import {
  AttemptLostError,
  JobsNotConfiguredError,
  PlaylistMissingError,
  StorageNotConfiguredError,
  webContract,
} from "./contract";
import { env } from "./env";

export interface CreateWebORPCContextOptions {
  /** Заголовки запроса: по ним процедуры проверяют доступ. */
  headers: Headers;
}

export function createWebORPCContext(opts: CreateWebORPCContextOptions) {
  return { headers: opts.headers };
}

export type WebORPCContext = ReturnType<typeof createWebORPCContext>;

/**
 * HTTP-статусы для своих кодов ошибок: в v2 статус задаёт обработчик, а не
 * ошибка. Клиенты различают ошибки по коду, статус нужен логам и прокси.
 */
export const webErrorStatusMap: Record<string, number> = {
  ...COMMON_ERROR_STATUS_MAP,
  [JobsNotConfiguredError.code]: 503,
  [StorageNotConfiguredError.code]: 503,
  [AttemptLostError.code]: 409,
  [PlaylistMissingError.code]: 409,
};

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
export function isBearerAuthorized(
  header: string | null,
  secret: string,
): boolean {
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

/**
 * Процедуры воркера. Middleware висят на уровне поддерева, до валидации
 * входа: неавторизованный запрос отбивается, не доходя до схем.
 */
export const jobs = os.jobs.use(timingMiddleware).use(requireJobsSecret);
