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
  /** Товары с подтверждённым остатком и требуемым скрытием. */
  syncedSlugs: z.array(z.string()),
  /** Ошибки обновления остатка или скрытия с витрины. */
  failed: z.array(z.object({ offerId: z.string(), error: z.string() })),
  /** SKU, скрытые с витрин Ozon и Селект. */
  hidden: z.array(z.number().int().positive()),
});

export type OzonStockPushResult = z.infer<typeof ozonStockPushResultSchema>;

export const ozonContract = {
  /**
   * Дублирует остаток товаров на FBS-склад Ozon и скрывает готовые изделия
   * с витрины Ozon. Админка зовёт после правки остатка: ключи Seller API
   * есть только у витрины.
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
};
