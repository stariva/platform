import { measurementEntrySchema } from "@stariva/web-api/contract";
import { z } from "zod";

/** Изделий под заказ в одной позиции: каждое плетётся отдельно. */
export const MAX_MADE_TO_ORDER_QUANTITY = 10;
/** Позиций под заказ в одном заказе. */
export const MAX_MADE_TO_ORDER_LINES = 20;

// Мерка живёт в контракте API: по ней проверяют и форму, и сервер
export { measurementEntrySchema };

/** Параметры изделия под заказ: что выбрал покупатель и что уточнил после оплаты. */
export const madeToOrderOptionsSchema = z.object({
  size: z.string().trim().min(1).max(60),
  color: z.string().trim().min(1).max(60),
  measurements: z.array(measurementEntrySchema).max(10).default([]),
  comment: z.string().trim().max(1500).optional(),
});

export type MadeToOrderOptions = z.infer<typeof madeToOrderOptionsSchema>;

/** Подпись параметров для корзины, заказа и уведомления: «Размер: M · Цвет: Бежевый». */
export function describeMadeToOrderOptions(
  options: MadeToOrderOptions,
): string {
  return [
    `Размер: ${options.size}`,
    `Цвет: ${options.color}`,
    ...options.measurements.map((m) => `${m.label}: ${m.value} см`),
    options.comment ? `Комментарий: ${options.comment}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
