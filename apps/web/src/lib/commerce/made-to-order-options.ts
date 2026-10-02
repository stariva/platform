import { z } from "zod";

/** Изделий под заказ в одной позиции: каждое плетётся отдельно. */
export const MAX_MADE_TO_ORDER_QUANTITY = 10;
/** Позиций под заказ в одном заказе. */
export const MAX_MADE_TO_ORDER_LINES = 20;

/** Одна мерка в см: подпись сохраняем как в момент заказа. */
export const measurementEntrySchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z
    .string()
    .trim()
    .regex(/^\d{1,4}(?:[.,]\d{1,2})?$/, "Введите положительное число")
    .refine((value) => Number(value.replace(",", ".")) > 0, {
      message: "Введите положительное число",
    }),
});

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
