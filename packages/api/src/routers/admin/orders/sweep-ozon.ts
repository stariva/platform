import { z } from "zod";
import { adminProcedure } from "../../../orpc";
import { sweepStorefrontOzonDeliveries } from "../../../storefront";

const sweepResultSchema = z.object({
  /** false — витрина недоступна: нет настроек или сбой связи. */
  ran: z.boolean(),
  checked: z.number().int().nonnegative(),
  repriced: z.number().int().nonnegative(),
  shipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

/**
 * Кнопка «Создать отправления Ozon» на странице заказов: просит витрину
 * догнать заказы под заказ после сбоя Ozon Доставки — заменить цены-заглушки
 * до оплаты и создать зависшие отправления, если вебхук не смог. Прогон
 * идемпотентен, повторы безопасны; пока Ozon не починен, он честно
 * ответит, сколько не вышло.
 */
export const sweepOzonDeliveries = adminProcedure
  .output(sweepResultSchema)
  .handler(async () => {
    const result = await sweepStorefrontOzonDeliveries();
    return result
      ? { ran: true, ...result }
      : { ran: false, checked: 0, repriced: 0, shipped: 0, failed: 0 };
  });
