import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AccountOrder } from "@/lib/account/orders";
import { orderProgress } from "@/lib/commerce/order-status";
import { pluralItems } from "@/lib/in-stock";
import {
  ItemImage,
  kindLabels,
  money,
  orderDateFormatter,
  ProgressBar,
  StatusBadge,
} from "./order-ui";

/** Плиток в ряду: влезают в карточку и на телефоне. Больше — последняя становится «+N». */
const MAX_TILES = 4;

/** Главное действие по заказу: то, ради чего покупатель сюда пришёл. */
function primaryAction(order: AccountOrder) {
  if (order.paymentStep) {
    return {
      label: `Оплатить ${order.paymentStep.type === "deposit" ? "предоплату" : "доплату"}`,
      href: `/account/orders/${order.id}`,
    };
  }
  if (order.kind === "workshop" && order.workshopSlug) {
    if (order.status === "paid") {
      return {
        label: "Перейти к курсу",
        href: `/account/workshops/${order.workshopSlug}`,
      };
    }
    if (order.status === "pending") {
      return { label: "Оплатить", href: `/workshops/${order.workshopSlug}` };
    }
  }
  return null;
}

export function OrderCard({ order }: { order: AccountOrder }) {
  const href = `/account/orders/${order.id}`;
  const progress = orderProgress(order.kind, order.status);
  const action = primaryAction(order);
  const [first, ...rest] = order.items;
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const thumbs =
    order.items.length > MAX_TILES
      ? order.items.slice(0, MAX_TILES - 1)
      : order.items;
  const hidden = order.items.length - thumbs.length;

  return (
    <article className="group relative bg-white border border-espresso/10 rounded-2xl overflow-hidden transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(22,21,19,0.18)]">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 bg-sand/60 border-b border-espresso/8">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-espresso">
            <Link
              href={href}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-espresso focus-visible:after:rounded-2xl"
            >
              {order.number ? `Заказ №${order.number}` : kindLabels.workshop}
            </Link>
          </h2>
          <p className="text-xs text-taupe">
            {orderDateFormatter.format(order.createdAt)}
            {order.number && ` · ${kindLabels[order.kind]}`}
          </p>
        </div>
        <StatusBadge kind={order.kind} status={order.status} />
      </header>

      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex gap-2">
            {thumbs.map((item) => (
              <ItemImage
                key={item.id}
                src={item.image}
                alt={item.name}
                sizes="112px"
                // Обложки курсов широкие — не обрезаем их в квадрат
                className={
                  order.kind === "workshop" ? "h-16 w-28" : "size-14 sm:size-16"
                }
              />
            ))}
            {hidden > 0 && (
              <span className="flex size-14 sm:size-16 items-center justify-center rounded-lg bg-sand text-sm text-taupe">
                +{hidden}
              </span>
            )}
          </div>
          <div className="min-w-[10rem] flex-1">
            <p className="text-sm text-espresso line-clamp-2">
              {first?.name}
              {rest.length > 0 && (
                <span className="text-taupe">
                  {" "}
                  и ещё {rest.length} {pluralItems(rest.length)}
                </span>
              )}
            </p>
            {order.kind !== "workshop" && (
              <p className="text-xs text-taupe mt-1">
                {quantity} {pluralItems(quantity)}
              </p>
            )}
          </div>
        </div>

        {progress && <ProgressBar progress={progress} />}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <p className="font-serif text-lg text-espresso tabular-nums">
          {money(order.paymentStep?.amount ?? order.amountTotal)}
          {order.paymentStep && (
            <span className="ml-2 font-sans text-xs text-taupe">
              к оплате из {money(order.amountTotal)}
            </span>
          )}
        </p>
        <div className="relative z-10 flex items-center gap-2">
          {action && (
            <Button
              asChild
              size="sm"
              className="bg-espresso text-parchment hover:bg-espresso/90"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="text-espresso">
            <Link href={href}>
              Подробнее
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
