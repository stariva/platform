import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Догонялка заказов под заказ, которым помешал сбой Ozon Доставки, — каждые
 * 10 минут. Сбой Ozon не стопорит покупателя: расчёт сохраняется с ценой-
 * заглушкой. Здесь она заменяется реальной, пока доплата не оплачена, а
 * оплаченным заказам создаются отправления, если вебхук не смог. Прогон
 * идемпотентен: повторы безопасны, тихие неудачи ждут следующего прогона.
 */
export const madeToOrderDeliveryWorkflow = hatchet.workflow({
  name: "made-to-order-delivery",
  on: {
    cron: "*/10 * * * *",
  },
});

madeToOrderDeliveryWorkflow.task({
  name: "sweep",
  retries: 2,
  executionTimeout: "4m",
  fn: () =>
    webApi.jobs.madeToOrder.sweep(undefined, {
      context: { timeout: 230_000 },
    }),
});
