import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Секреты, которые нужны только процедурам витрины. Общие переменные
 * (база, бакет, APP_URL, REVALIDATE_SECRET) читают свои пакеты:
 * @stariva/db, @stariva/storage, @stariva/config.
 */
export const env = createEnv({
  server: {
    // Общий секрет сайта и воркера Hatchet (apps/jobs): воркер вызывает
    // процедуры jobs.* с Authorization: Bearer …
    JOBS_SECRET: z.string().min(32).optional(),

    // Ozon Seller API: остаток готовых изделий на складе Ozon (admin.ozon.*)
    OZON_API_KEY: z.string().min(1).optional(),
    OZON_CLIENT_ID: z.string().min(1).optional(),
    // FBS-склад, с которого Ozon Доставка отгружает готовые изделия сайта.
    // Ozon Доставка продаёт только то, что числится в остатке на Ozon,
    // поэтому остаток из админки дублируется сюда. По умолчанию — Лотошино_наличие.
    OZON_FBS_WAREHOUSE_ID: z.coerce
      .number()
      .int()
      .positive()
      .default(1020005006898070),
  },
  runtimeEnv: {
    JOBS_SECRET: process.env.JOBS_SECRET,
    OZON_API_KEY: process.env.OZON_API_KEY,
    OZON_CLIENT_ID: process.env.OZON_CLIENT_ID,
    OZON_FBS_WAREHOUSE_ID: process.env.OZON_FBS_WAREHOUSE_ID,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
