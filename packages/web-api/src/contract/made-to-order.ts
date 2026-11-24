import { z } from "zod";

/**
 * Чем кончился прогон догонялки заказов под заказ: зовут и воркер Hatchet
 * (jobs.madeToOrder.sweep), и кнопка в админке (admin.madeToOrder.sweep).
 */
export const madeToOrderSweepResult = z.object({
  /** Заказов просмотрено. */
  checked: z.number().int().nonnegative(),
  /** Заглушки заменены реальной ценой Ozon до оплаты. */
  repriced: z.number().int().nonnegative(),
  /** Отправления созданы после того, как вебхук не смог. */
  shipped: z.number().int().nonnegative(),
  /** Не вышло: Ozon ещё не ожил или отказал по бизнес-причине. */
  failed: z.number().int().nonnegative(),
});

export type MadeToOrderDeliverySweepResult = z.infer<
  typeof madeToOrderSweepResult
>;
