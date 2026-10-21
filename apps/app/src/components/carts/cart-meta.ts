import type {
  CartEventAction,
  CartEventItem,
  VisitorInfo,
} from "@stariva/db/schema";
import { visitorPlace } from "~/components/visitors/visitor-card";

export const ACTION_LABELS: Record<CartEventAction, string> = {
  add: "Положил",
  remove: "Убрал",
  quantity: "Изменил количество",
  clear: "Очистил корзину",
  sync: "Сайт подрезал под остаток",
  order: "Оформил",
};

/** Сумма корзины в копейках. */
export const cartTotal = (items: CartEventItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

/** «M, бежевый» у изделия под заказ, иначе null. */
export const optionsLabel = (options: CartEventItem["options"]) =>
  options ? `${options.size}, ${options.color}` : null;

/** «Москва · iPhone, iOS 18.1» — коротко о госте; null, если ничего не известно. */
export function visitorSummary(visitor: VisitorInfo | null): string | null {
  if (!visitor) return null;
  const place = visitor.city ?? visitorPlace(visitor);
  const device = visitor.deviceModel ?? visitor.os ?? visitor.browser;
  return [place, device].filter(Boolean).join(" · ") || visitor.ip;
}
