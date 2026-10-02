import { z } from "zod";

const fulfillmentTypeSchema = z.enum(["stock", "made_to_order"]);

/**
 * Корзина лежит в браузере, а цена и остаток живут в каталоге. Этот ответ
 * сверяет одно с другим: страница корзины по нему обновляет цены, ограничивает
 * количество остатком и помечает товары, которые уже нельзя купить.
 */
export const cartValidationLineSchema = z.discriminatedUnion("available", [
  z.object({
    productSlug: z.string(),
    fulfillmentType: fulfillmentTypeSchema,
    available: z.literal(true),
    name: z.string(),
    image: z.string(),
    /** Только у готовых изделий: у изделий под заказ SKU нет. */
    ozonSku: z.number().int().positive().optional(),
    /** В копейках */
    price: z.number().int().positive(),
    /** Сколько изделий можно положить в заказ: свободный остаток (для готовых) или лимит, но не больше лимита корзины. */
    maxQuantity: z.number().int().positive(),
  }),
  z.object({
    productSlug: z.string(),
    fulfillmentType: fulfillmentTypeSchema,
    available: z.literal(false),
    /** missing — изделия нет в каталоге или его не плетут под заказ; sold_out — нет в наличии */
    reason: z.enum(["missing", "sold_out"]),
  }),
]);

export const cartValidationResponseSchema = z.object({
  lines: z.array(cartValidationLineSchema),
});

export type CartValidationLine = z.infer<typeof cartValidationLineSchema>;

/** Ключ строки ответа: один и тот же товар бывает и готовым, и под заказ. */
export function validationLineKey(line: {
  productSlug: string;
  fulfillmentType: "stock" | "made_to_order";
}): string {
  return `${line.fulfillmentType}:${line.productSlug}`;
}
