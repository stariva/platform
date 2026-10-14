import { timingSafeEqual } from "node:crypto";
import { implement, ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import { webContract } from "./contract";
import { env } from "./env";

export interface CreateWebORPCContextOptions {
  /** Заголовки запроса: по ним процедуры проверяют доступ. */
  headers: Headers;
}

export function createWebORPCContext(opts: CreateWebORPCContextOptions) {
  return { headers: opts.headers };
}

export type WebORPCContext = ReturnType<typeof createWebORPCContext>;

const os = implement(webContract).$context<WebORPCContext>();

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

/** Процедуры для воркера Hatchet: доступ по общему JOBS_SECRET. */
export const jobs = os.jobs.use(timingMiddleware).use(({ context, next }) => {
  const secret = env.JOBS_SECRET;
  if (!secret) {
    throw new ORPCError("JOBS_NOT_CONFIGURED", {
      status: 503,
      message: "jobs_not_configured",
      defined: true,
    });
  }
  if (!isBearerAuthorized(context.headers.get("authorization"), secret)) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next();
});
