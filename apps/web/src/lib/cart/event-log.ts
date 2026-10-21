import { db, eq } from "@stariva/db";
import {
  CART_EVENT_ACTIONS,
  cartEvents,
  productOrders,
  type VisitorInfo,
} from "@stariva/db/schema";
import { z } from "zod";

// Как MAX_CART_QUANTITY в cart-context: тот модуль клиентский, на сервер его не тянем
const quantity = z.number().int().min(0).max(99);

const lineSchema = z.object({
  productSlug: z.string().min(1).max(256),
  fulfillmentType: z.enum(["stock", "made_to_order"]),
  name: z.string().min(1).max(300),
  price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  options: z
    .object({ size: z.string().max(60), color: z.string().max(60) })
    .optional(),
});

/** Что присылает браузер (lib/cart/events.ts); лишние поля отбрасываются. */
export const cartEventSchema = z.object({
  cartId: z.string().regex(/^[\w-]{8,64}$/),
  action: z.enum(CART_EVENT_ACTIONS),
  changes: z
    .array(lineSchema.extend({ before: quantity, after: quantity }))
    .max(100),
  items: z
    .array(
      lineSchema.extend({
        image: z.string().max(1000).optional(),
        quantity: quantity.min(1),
      }),
    )
    .max(100),
  orderId: z.string().min(1).max(100).optional(),
});

export type CartEventInput = z.infer<typeof cartEventSchema>;

/**
 * Пишет изменение корзины в журнал. Заказ привязывает, только если он есть
 * в базе. Не бросает исключений: журнал — для админки, покупателю он не нужен.
 */
export async function recordCartEvent(
  event: CartEventInput,
  { userId, visitor }: { userId: string | null; visitor: VisitorInfo },
): Promise<void> {
  try {
    let orderId: string | null = null;
    if (event.orderId) {
      const [order] = await db
        .select({ id: productOrders.id })
        .from(productOrders)
        .where(eq(productOrders.id, event.orderId))
        .limit(1);
      orderId = order?.id ?? null;
    }
    await db.insert(cartEvents).values({
      id: crypto.randomUUID(),
      cartId: event.cartId,
      userId,
      action: event.action,
      changes: event.changes,
      items: event.items,
      orderId,
      ip: visitor.ip,
      visitor,
    });
  } catch (error) {
    console.error("[cart-events] failed to record event", error);
  }
}
