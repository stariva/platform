import { measurementEntrySchema } from "@stariva/web-api/contract";
import { z } from "zod";

// Мерка и лимиты заявки живут в контракте API: по ним проверяют и форму, и сервер
export {
  MAX_MADE_TO_ORDER_LINES,
  MAX_MADE_TO_ORDER_QUANTITY,
  measurementEntrySchema,
} from "@stariva/web-api/contract";

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
