import { error, oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Процедуры, которые вызывает админка (app.stariva.ru, @stariva/api).
 * Доступ — по общему REVALIDATE_SECRET в `Authorization: Bearer …`.
 */

/** На сайте не задан REVALIDATE_SECRET: админке тут делать нечего. */
export const AdminNotConfiguredError = error("ADMIN_NOT_CONFIGURED", {
  message: "admin_not_configured",
});

/** У витрины нет ключей Ozon Seller API. */
export const OzonNotConfiguredError = error("OZON_NOT_CONFIGURED", {
  message: "ozon_not_configured",
});

/** Ozon Seller API не ответил или ответил ошибкой; подробности — в логе сайта. */
export const OzonRequestFailedError = error("OZON_REQUEST_FAILED", {
  message: "ozon_request_failed",
});

const base = oc.errors({
  [AdminNotConfiguredError.code]: AdminNotConfiguredError,
});

export const ozonStockPushResultSchema = z.object({
  /** Артикулы, остаток которых Ozon принял. */
  updated: z.array(z.string()),
  /** Товары с подтверждённым остатком и нужной видимостью на Ozon. */
  syncedSlugs: z.array(z.string()),
  /** Ошибки обновления остатка или скрытия с витрины. */
  failed: z.array(z.object({ offerId: z.string(), error: z.string() })),
  /** SKU, скрытые с витрин Ozon и Селект. */
  hidden: z.array(z.number().int().positive()),
  /** SKU, выставленные на витрину Ozon: товары, которые продаются и там. */
  shown: z.array(z.number().int().positive()),
});

export type OzonStockPushResult = z.infer<typeof ozonStockPushResultSchema>;

export const ozonStockPullResultSchema = z.object({
  /** false — у витрины нет ключей Seller API, сверки не было. */
  configured: z.boolean(),
  /** Сколько товаров продаётся и на Ozon. */
  checked: z.number().int().nonnegative(),
  /** Товары, остаток которых уменьшен до свободного остатка на Ozon. */
  lowered: z.array(
    z.object({
      slug: z.string(),
      category: z.string(),
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative(),
    }),
  ),
});

export type OzonStockPullResult = z.infer<typeof ozonStockPullResultSchema>;

/**
 * Посылка изделия под заказ, которую упаковал мастер. Верхние границы — лимиты
 * Ozon Доставки для бизнеса: до 125 кг и до 250 см.
 */
export const madeToOrderParcelSchema = z.object({
  weightGrams: z.number().int().positive().max(125_000),
  lengthCm: z.number().int().positive().max(250),
  widthCm: z.number().int().positive().max(250),
  heightCm: z.number().int().positive().max(250),
});

export type MadeToOrderParcel = z.infer<typeof madeToOrderParcelSchema>;

export const ozonContract = {
  /**
   * Дублирует остаток товаров на FBS-склад Ozon и скрывает готовые изделия
   * с витрины Ozon; товары, которые продаются и на Ozon, наоборот, выставляет
   * на витрину. Админка зовёт после правки остатка или флага продажи на
   * Ozon: ключи Seller API есть только у витрины.
   */
  pushStock: base
    .errors({
      [OzonNotConfiguredError.code]: OzonNotConfiguredError,
      [OzonRequestFailedError.code]: OzonRequestFailedError,
    })
    .input(
      z.object({
        slugs: z.array(z.string().min(1).max(256)).min(1).max(100),
      }),
    )
    .output(ozonStockPushResultSchema),
};

export const adminContract = {
  ozon: ozonContract,

  /**
   * Сбрасывает кэш страниц витрины после правок каталога. Путь с `[…]`
   * (шаблон маршрута) сбрасывает все его страницы.
   */
  revalidate: base
    .input(
      z.object({
        paths: z
          .array(
            z
              .string()
              .max(1024)
              .regex(/^\/[^\s?#]*$/, "Ожидается путь страницы"),
          )
          .min(1)
          .max(50),
      }),
    )
    .output(z.object({ revalidated: z.number().int().nonnegative() })),
};
