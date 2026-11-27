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
  /** Снимок состава готового набора на момент заказа. */
  contents: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .max(30)
    .optional(),
});

export type MadeToOrderOptions = z.infer<typeof madeToOrderOptionsSchema>;

/** Состав одного готового набора короткой строкой: «Снежинка, Варежка × 2». */
export function describeMadeToOrderContents(
  contents: NonNullable<MadeToOrderOptions["contents"]>,
): string {
  return contents
    .map((item) =>
      item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name,
    )
    .join(", ");
}

/** Подпись параметров для корзины, заказа и уведомления: «Размер: M · Цвет: Бежевый». */
export function describeMadeToOrderOptions(
  options: MadeToOrderOptions,
): string {
  return [
    `Размер: ${options.size}`,
    `Цвет: ${options.color}`,
    ...(options.contents?.length
      ? [
          `Состав одного набора: ${describeMadeToOrderContents(options.contents)}`,
        ]
      : []),
    ...options.measurements.map((m) => `${m.label}: ${m.value} см`),
    options.comment ? `Комментарий: ${options.comment}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
