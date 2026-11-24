import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Пульс Ozon Доставки — каждые 10 минут: сбой (отозванные ключи, лежащий
 * сервис) виден мастеру раньше, чем его встретит покупатель. Заказами крон
 * больше не управляет: пересчёт заглушек и создание зависших отправлений
 * запускает мастер кнопкой «Создать отправления Ozon» в админке.
 */
export const madeToOrderDeliveryWorkflow = hatchet.workflow({
  name: "made-to-order-delivery",
  on: {
    cron: "*/10 * * * *",
  },
});

madeToOrderDeliveryWorkflow.task({
  name: "pulse",
  retries: 2,
  executionTimeout: "60s",
  fn: () =>
    webApi.jobs.madeToOrder.sweep(
      { orders: false },
      { context: { timeout: 50_000 } },
    ),
});
