"use client";

import {
  ArrowRightIcon,
  LockKeyholeIcon,
  PackageCheckIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IN_STOCK_SHIP_DAYS, pluralItems } from "@/lib/in-stock";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

interface CartSummaryProps {
  /** Сумма и количество только по тем изделиям, которые можно купить */
  subtotal: number;
  count: number;
  unavailableCount: number;
  checking: boolean;
  onRemoveUnavailable: () => void;
  /** Кнопка оформления — по ней мобильная панель понимает, что итог на экране */
  ctaRef?: Ref<HTMLDivElement>;
}

export function CartSummary({
  subtotal,
  count,
  unavailableCount,
  checking,
  onRemoveUnavailable,
  ctaRef,
}: CartSummaryProps) {
  const blocked = unavailableCount > 0 || count === 0;

  return (
    <aside className="lg:sticky lg:top-28 space-y-4">
      <div className="bg-sand rounded-2xl p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-espresso mb-5">Сумма заказа</h2>

        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-taupe">
              {count} {pluralItems(count)}
            </dt>
            <dd className="text-espresso tabular-nums">
              {formatPrice(subtotal / 100)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-taupe">Доставка Ozon</dt>
            <dd className="text-taupe text-right">на следующем шаге</dd>
          </div>
        </dl>

        <div className="mt-5 pt-5 border-t border-espresso/10 flex items-baseline justify-between gap-4">
          <span className="text-espresso">Итого</span>
          <span className="text-espresso text-2xl font-medium tabular-nums">
            {formatPrice(subtotal / 100)}
          </span>
        </div>

        {unavailableCount > 0 && (
          <div className="mt-5 rounded-xl bg-parchment px-4 py-3 text-sm text-espresso">
            <p>
              {unavailableCount === 1
                ? "Одного изделия уже нет в наличии."
                : `${unavailableCount} ${pluralItems(unavailableCount)} уже нет в наличии.`}
            </p>
            <button
              type="button"
              onClick={onRemoveUnavailable}
              className="mt-1 underline underline-offset-4 hover:text-taupe transition-colors"
            >
              Убрать и продолжить
            </button>
          </div>
        )}

        <div ref={ctaRef} className="mt-5">
          <CheckoutButton blocked={blocked} className="w-full h-14" />
        </div>

        <div
          className="mt-3 h-4 flex items-center justify-center gap-1.5 text-xs text-taupe"
          aria-live="polite"
        >
          {checking && (
            <>
              <Spinner className="size-3" />
              Проверяем наличие и цены…
            </>
          )}
        </div>
      </div>

      <ul className="px-1 space-y-3 text-[13px] text-taupe">
        {[
          { Icon: PackageCheckIcon, text: `Отправим за ${IN_STOCK_SHIP_DAYS}` },
          {
            Icon: TruckIcon,
            text: "Доставка в пункт выдачи Ozon по всей России",
          },
          {
            Icon: LockKeyholeIcon,
            text: "Безопасная онлайн-оплата через ЮKassa",
          },
        ].map(({ Icon, text }) => (
          <li key={text} className="flex gap-3">
            <Icon
              className="size-4 shrink-0 mt-px text-espresso"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {text}
          </li>
        ))}
      </ul>

      <p className="px-1 text-[13px] text-taupe">
        Есть вопрос по заказу?{" "}
        <a
          href="https://t.me/Olga_Stariva"
          target="_blank"
          rel="noopener noreferrer"
          className="text-espresso underline underline-offset-4 hover:text-taupe transition-colors"
        >
          Напишите в Telegram
        </a>
      </p>
    </aside>
  );
}

function CheckoutButton({
  blocked,
  className,
}: {
  blocked: boolean;
  className?: string;
}) {
  const classes = cn(
    "rounded-full bg-espresso text-parchment hover:bg-espresso/85 text-[15px]",
    className,
  );
  if (blocked) {
    return (
      <Button type="button" disabled className={classes}>
        Перейти к оформлению
      </Button>
    );
  }
  return (
    <Button asChild className={classes}>
      <Link href="/checkout">
        Перейти к оформлению
        <ArrowRightIcon aria-hidden="true" />
      </Link>
    </Button>
  );
}

/**
 * На телефоне итог оказывается под списком изделий — держим сумму и кнопку
 * под пальцем, пока основная кнопка не появится на экране.
 */
export function MobileCheckoutBar({
  subtotal,
  count,
  blocked,
  visible,
}: {
  subtotal: number;
  count: number;
  blocked: boolean;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-espresso/10 bg-parchment/95 backdrop-blur-md px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center gap-4 max-w-xl mx-auto">
        <div className="min-w-0">
          <p className="text-lg font-medium text-espresso tabular-nums leading-tight">
            {formatPrice(subtotal / 100)}
          </p>
          <p className="text-xs text-taupe whitespace-nowrap">
            {count} {pluralItems(count)}
          </p>
        </div>
        <CheckoutButton blocked={blocked} className="flex-1 h-12" />
      </div>
    </div>
  );
}
