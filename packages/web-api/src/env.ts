import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Секреты, которые нужны только процедурам витрины. Общие переменные
 * (база, бакет, APP_URL) читают свои пакеты: @stariva/db, @stariva/storage,
 * @stariva/config.
 */
export const env = createEnv({
  server: {
    // Общий секрет сайта и воркера Hatchet (apps/jobs): воркер вызывает
    // процедуры jobs.* с Authorization: Bearer …
    JOBS_SECRET: z.string().min(32).optional(),
  },
  runtimeEnv: {
    JOBS_SECRET: process.env.JOBS_SECRET,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
