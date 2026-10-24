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

    // Выгрузка Метрики и Директа (jobs.analytics.*). OAuth-токены из
    // приложения на oauth.yandex.ru: metrika:read и direct:api.
    YANDEX_METRIKA_TOKEN: z.string().min(1).optional(),
    YANDEX_METRIKA_COUNTER_ID: z.coerce
      .number()
      .int()
      .positive()
      .default(96190087),
    YANDEX_DIRECT_TOKEN: z.string().min(1).optional(),
    // Логин рекламодателя, если токен выдан представителю или агентству
    YANDEX_DIRECT_CLIENT_LOGIN: z.string().min(1).optional(),
    // Цели Метрики для конверсий Директа через запятую, не больше 10.
    // Без списка — первые 10 целей счётчика.
    YANDEX_DIRECT_GOAL_IDS: z
      .string()
      .regex(/^\d+(,\d+)*$/)
      .optional(),
  },
  runtimeEnv: {
    JOBS_SECRET: process.env.JOBS_SECRET,
    OZON_API_KEY: process.env.OZON_API_KEY,
    OZON_CLIENT_ID: process.env.OZON_CLIENT_ID,
    OZON_FBS_WAREHOUSE_ID: process.env.OZON_FBS_WAREHOUSE_ID,
    YANDEX_METRIKA_TOKEN: process.env.YANDEX_METRIKA_TOKEN,
    YANDEX_METRIKA_COUNTER_ID: process.env.YANDEX_METRIKA_COUNTER_ID,
    YANDEX_DIRECT_TOKEN: process.env.YANDEX_DIRECT_TOKEN,
    YANDEX_DIRECT_CLIENT_LOGIN: process.env.YANDEX_DIRECT_CLIENT_LOGIN,
    YANDEX_DIRECT_GOAL_IDS: process.env.YANDEX_DIRECT_GOAL_IDS,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
