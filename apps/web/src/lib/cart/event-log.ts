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

// HTTPS-хосты из images.remotePatterns в apps/web/next.config.ts.
const CART_IMAGE_HOSTS = new Set([
  "cdn1.ozon.ru",
  "cdn2.ozon.ru",
  "cdn3.ozon.ru",
  "cdn1.ozone.ru",
  "cdn2.ozone.ru",
  "cdn3.ozone.ru",
  "ir.ozone.ru",
  "s3.ozone.ru",
  "storage.yandexcloud.net",
  "cdn.stariva.ru",
]);

function isAllowedCartImage(source: string): boolean {
  // URL нормализует обратные слеши и управляющие символы в разделители.
  if (/[\p{Cc}\s\\]/u.test(source)) return false;
  if (source.startsWith("/")) return !source.startsWith("//");
  try {
    const url = new URL(source);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (CART_IMAGE_HOSTS.has(url.hostname) ||
        url.hostname.endsWith(".storage.yandexcloud.net"))
    );
  } catch {
    return false;
  }
}

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
        image: z
          .string()
          .max(1000)
          .refine(isAllowedCartImage)
          .optional()
          .catch(undefined),
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
