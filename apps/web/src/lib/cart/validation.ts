import { z } from "zod";

/**
 * Корзина лежит в браузере, а цена и остаток живут в каталоге. Этот ответ
 * сверяет одно с другим: страница корзины по нему обновляет цены, ограничивает
 * количество остатком и помечает товары, которые уже нельзя купить.
 */
export const cartValidationLineSchema = z.discriminatedUnion("available", [
  z.object({
    productSlug: z.string(),
    available: z.literal(true),
    name: z.string(),
    image: z.string(),
    ozonSku: z.number().int().positive(),
    /** В копейках */
    price: z.number().int().positive(),
    /** Сколько изделий можно положить в заказ: свободный остаток, но не больше лимита. */
    maxQuantity: z.number().int().positive(),
  }),
  z.object({
    productSlug: z.string(),
    available: z.literal(false),
    /** missing — изделия нет в каталоге; sold_out — нет в наличии */
    reason: z.enum(["missing", "sold_out"]),
  }),
]);

export const cartValidationResponseSchema = z.object({
  lines: z.array(cartValidationLineSchema),
});

export type CartValidationLine = z.infer<typeof cartValidationLineSchema>;
