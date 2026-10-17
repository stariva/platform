import { timingSafeEqual } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { env as baseEnv } from "@stariva/config";
import { AdminNotConfiguredError, JobsNotConfiguredError } from "./contract";
import { env } from "./env";
import { os, timingMiddleware } from "./orpc";

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

/** Сессия покупателя (или null) — в контекст процедур кабинета. */
const withSession = os.middleware(async ({ context, next }) =>
  next({ context: { session: await context.getSession() } }),
);

/*
 * Поддеревья API с их доступом. Middleware висят на уровне поддерева, до
 * валидации входа: неавторизованный запрос отбивается, не доходя до схем.
 */

/** Процедуры воркера Hatchet. */
export const jobs = os.jobs.use(timingMiddleware).use(requireJobsSecret);

/** Процедуры админки. */
export const admin = os.admin.use(timingMiddleware).use(requireAdminSecret);

/** Публичные формы: без входа. */
export const forms = os.forms.use(timingMiddleware);

/** Гостевой заказ: без входа, покупателя подтверждает телефон из заказа. */
export const orders = os.orders.use(timingMiddleware);

/** Процедуры кабинета покупателя: вызывает браузер с cookie сессии. */
export const account = os.account.use(timingMiddleware).use(withSession);
