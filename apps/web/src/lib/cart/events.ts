import type {
  CartEventAction,
  CartEventChange,
  CartEventItem,
} from "@stariva/db/schema";
import { type CartItem, cartLineKey } from "./cart-context";

const CART_ID_KEY = "stariva:cart-id";

/** Если localStorage недоступен, корзина живёт до перезагрузки — и id тоже. */
let memoryCartId: string | undefined;

/** Случайный id корзины этого браузера: по нему админка собирает события в одну строку. */
function cartId(): string {
  try {
    const stored = window.localStorage.getItem(CART_ID_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(CART_ID_KEY, created);
    return created;
  } catch {
    memoryCartId ??= crypto.randomUUID();
    return memoryCartId;
  }
}

/** Строка корзины для журнала: без SKU, мерок и комментария. */
export function toEventItem(item: CartItem): CartEventItem {
  return {
    productSlug: item.productSlug,
    fulfillmentType: item.fulfillmentType,
    name: item.name,
    ...(item.image ? { image: item.image } : {}),
    price: item.price,
    quantity: item.quantity,
    ...(item.options
      ? { options: { size: item.options.size, color: item.options.color } }
      : {}),
  };
}

/** Строки, у которых поменялось количество; цена и название изменением не считаются. */
export function cartChanges(
  before: CartItem[],
  after: CartItem[],
): CartEventChange[] {
  const previous = new Map(before.map((item) => [cartLineKey(item), item]));
  const changes: CartEventChange[] = [];
  for (const item of after) {
    const key = cartLineKey(item);
    const was = previous.get(key);
    previous.delete(key);
    if (was?.quantity === item.quantity) continue;
    const { quantity, image: _image, ...line } = toEventItem(item);
    changes.push({ ...line, before: was?.quantity ?? 0, after: quantity });
  }
  for (const item of previous.values()) {
    const { quantity, image: _image, ...line } = toEventItem(item);
    changes.push({ ...line, before: quantity, after: 0 });
  }
  return changes;
}

/**
 * Отправляет изменение корзины в журнал для админки. Ничего не ждёт и не
 * бросает: корзина важнее статистики. keepalive — чтобы событие заказа
 * дошло, даже когда страница сразу уходит на оплату.
 */
export function logCartEvent({
  action,
  before,
  after,
  orderId,
}: {
  action: CartEventAction;
  before: CartItem[];
  after: CartItem[];
  orderId?: string;
}) {
  try {
    const changes = cartChanges(before, after);
    if (changes.length === 0 && !orderId) return;
    void fetch("/api/cart/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cartId(),
        action,
        changes,
        items: after.map(toEventItem),
        ...(orderId ? { orderId } : {}),
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* optional */
  }
}
