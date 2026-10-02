"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IN_STOCK_SHIP_DAYS, pluralItems } from "@/lib/in-stock";
import { formatPrice } from "@/lib/products";

interface CartSummaryProps {
  /** Сумма и количество только по тем изделиям, которые можно купить */
  subtotal: number;
  count: number;
  unavailableCount: number;
  checking: boolean;
  onRemoveUnavailable: () => void;
}

export function CartSummary({
  subtotal,
  count,
  unavailableCount,
  checking,
  onRemoveUnavailable,
}: CartSummaryProps) {
  const blocked = unavailableCount > 0 || count === 0;

  return (
    <aside className="bg-white border border-espresso/10 rounded-2xl p-5 sm:p-6 lg:sticky lg:top-32">
      <h2 className="font-serif text-xl text-espresso mb-4">Ваш заказ</h2>

      <dl className="space-y-2.5 text-sm">
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
          <dd className="text-espresso text-right">при оформлении</dd>
        </div>
      </dl>

      <div className="mt-4 pt-4 border-t border-espresso/10 flex items-baseline justify-between gap-4">
        <span className="text-espresso font-medium">Итого</span>
        <span className="text-espresso text-xl font-medium tabular-nums">
          {formatPrice(subtotal / 100)}
        </span>
      </div>
      <p className="mt-1 text-xs text-taupe text-right">
        без учёта доставки — покажем до оплаты
      </p>

      {unavailableCount > 0 && (
        <div className="mt-5 rounded-xl bg-sand px-4 py-3 text-sm text-espresso">
          <p>
            {unavailableCount === 1
              ? "Одного изделия уже нет в наличии."
              : `${unavailableCount} ${pluralItems(unavailableCount)} уже нет в наличии.`}
          </p>
          <button
            type="button"
            onClick={onRemoveUnavailable}
            className="mt-1 underline underline-offset-4 hover:text-terracotta transition-colors"
          >
            Убрать из корзины
          </button>
        </div>
      )}

      {blocked ? (
        <Button
          type="button"
          disabled
          className="mt-5 w-full h-auto py-6 bg-terracotta text-parchment"
        >
          Оформить заказ
        </Button>
      ) : (
        <Button
          asChild
          className="mt-5 w-full h-auto py-6 bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          <Link href="/checkout">Оформить заказ</Link>
        </Button>
      )}

      <div
        className="mt-2 h-4 flex items-center justify-center gap-1.5 text-xs text-taupe"
        aria-live="polite"
      >
        {checking && (
          <>
            <Spinner className="size-3" />
            Проверяем наличие и цены…
          </>
        )}
      </div>

      <ul className="mt-4 space-y-2 text-[13px] text-taupe">
        {[
          `Отправим со склада за ${IN_STOCK_SHIP_DAYS}`,
          "Доставка в пункт выдачи Ozon по России",
          "Оплата на сайте через ЮKassa",
        ].map((text) => (
          <li key={text} className="flex gap-2">
            <CheckIcon
              className="size-4 shrink-0 mt-px text-sage"
              aria-hidden="true"
            />
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-4 border-t border-espresso/10 text-sm text-taupe space-y-1.5">
        <Link
          href="/catalog"
          className="block text-espresso underline underline-offset-4 hover:text-terracotta transition-colors"
        >
          Продолжить покупки
        </Link>
        <p>
          Вопросы по заказу —{" "}
          <a
            href="https://t.me/Olga_Stariva"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-terracotta transition-colors"
          >
            Telegram
          </a>
        </p>
      </div>
    </aside>
  );
}
