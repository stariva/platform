"use client";

import { ChevronDownIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { CartItem } from "@/lib/cart/cart-context";
import { pluralItems } from "@/lib/in-stock";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

export type DeliveryCost =
  | { status: "unknown" }
  | { status: "loading" }
  | { status: "ready"; kopecks: number };

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  delivery: DeliveryCost;
}

function total(subtotal: number, delivery: DeliveryCost) {
  return subtotal + (delivery.status === "ready" ? delivery.kopecks : 0);
}

/** Состав и сумма заказа — справа от шагов на десктопе. */
export function OrderSummary({ items, subtotal, delivery }: OrderSummaryProps) {
  return (
    <aside className="hidden lg:block lg:sticky lg:top-28 rounded-2xl bg-sand p-6">
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2 className="font-serif text-2xl text-espresso">Ваш заказ</h2>
        <Link
          href="/cart"
          className="text-[13px] text-taupe underline-offset-4 hover:underline hover:text-espresso transition-colors"
        >
          Изменить
        </Link>
      </div>
      <SummaryBody items={items} subtotal={subtotal} delivery={delivery} />
    </aside>
  );
}

/** На телефоне состав заказа свёрнут в строку с суммой над шагами. */
export function MobileOrderSummary({
  items,
  subtotal,
  delivery,
}: OrderSummaryProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="lg:hidden mb-6 rounded-2xl bg-sand">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm text-espresso">
          {open ? "Скрыть состав" : "Ваш заказ"}
          <span className="text-taupe">
            · {count} {pluralItems(count)}
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 text-taupe transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
        <span className="text-espresso font-medium tabular-nums">
          {formatPrice(total(subtotal, delivery) / 100)}
        </span>
      </button>
      <div id={panelId} hidden={!open} className="px-5 pb-5">
        <SummaryBody items={items} subtotal={subtotal} delivery={delivery} />
        <Link
          href="/cart"
          className="mt-4 inline-block text-[13px] text-espresso underline underline-offset-4"
        >
          Изменить корзину
        </Link>
      </div>
    </div>
  );
}

function SummaryBody({ items, subtotal, delivery }: OrderSummaryProps) {
  return (
    <>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.productSlug} className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="relative w-14 h-16 rounded-lg overflow-hidden bg-parchment">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <ImageOffIcon
                    className="absolute inset-0 m-auto size-4 text-taupe/50"
                    aria-hidden="true"
                  />
                )}
              </div>
              {item.quantity > 1 && (
                <span className="absolute -top-1.5 -right-1.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-espresso px-1 text-[10px] font-medium text-parchment tabular-nums">
                  {item.quantity}
                </span>
              )}
            </div>
            <p className="flex-1 min-w-0 text-[13px] leading-snug text-espresso line-clamp-2">
              {item.name}
              {item.quantity > 1 && (
                <span className="sr-only">, {item.quantity} шт.</span>
              )}
            </p>
            <span className="shrink-0 text-[13px] text-espresso tabular-nums">
              {formatPrice((item.price * item.quantity) / 100)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 pt-5 border-t border-espresso/10 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-taupe">Товары</dt>
          <dd className="text-espresso tabular-nums">
            {formatPrice(subtotal / 100)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-taupe">Доставка</dt>
          <dd className="text-espresso tabular-nums text-right">
            {delivery.status === "ready" ? (
              delivery.kopecks === 0 ? (
                "бесплатно"
              ) : (
                formatPrice(delivery.kopecks / 100)
              )
            ) : delivery.status === "loading" ? (
              <Spinner className="size-3.5 text-taupe" />
            ) : (
              <span className="text-taupe">после выбора пункта</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 pt-5 border-t border-espresso/10 flex items-baseline justify-between gap-4">
        <span className="text-espresso">Итого</span>
        <span className="text-2xl font-medium text-espresso tabular-nums">
          {formatPrice(total(subtotal, delivery) / 100)}
        </span>
      </div>
    </>
  );
}
