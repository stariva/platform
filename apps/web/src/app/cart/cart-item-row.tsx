"use client";

import { ImageOffIcon, MinusIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type CartItem, MAX_CART_QUANTITY } from "@/lib/cart/cart-context";
import type { CartLineState } from "@/lib/cart/use-cart-validation";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

interface CartItemRowProps {
  item: CartItem;
  state: CartLineState;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemRow({
  item,
  state,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  const unavailable = state.status === "unavailable";
  const productHref = `/catalog/product/${item.productSlug}`;
  // Страницы изделия, которого нет в каталоге, не существует
  const linkable = !(unavailable && state.reason === "missing");
  const maxQuantity =
    state.status === "available" ? state.maxQuantity : MAX_CART_QUANTITY;
  const atLimit = item.quantity >= maxQuantity;
  const meta = [
    item.quantity > 1 && `${formatPrice(item.price / 100)} за шт.`,
    stockHint(item.quantity, maxQuantity),
  ]
    .filter(Boolean)
    .join(" · ");

  const thumb = (
    <div
      className={cn(
        "relative w-20 h-24 sm:w-24 sm:h-30 rounded-xl overflow-hidden bg-sand",
        unavailable && "opacity-50 grayscale",
      )}
    >
      {item.image ? (
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="96px"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-taupe/50">
          <ImageOffIcon className="size-6" aria-hidden="true" />
        </div>
      )}
    </div>
  );

  return (
    <li className="flex gap-4 sm:gap-5 py-5 first:pt-0 last:pb-0">
      {linkable ? (
        <Link
          href={productHref}
          className="shrink-0 transition-opacity hover:opacity-85"
          tabIndex={-1}
        >
          {thumb}
        </Link>
      ) : (
        <div className="shrink-0">{thumb}</div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-4">
          {linkable ? (
            <Link
              href={productHref}
              className={cn(
                "min-w-0 text-[15px] leading-snug line-clamp-2 transition-colors hover:text-taupe",
                unavailable ? "text-taupe" : "text-espresso",
              )}
            >
              {item.name}
            </Link>
          ) : (
            <p className="min-w-0 text-[15px] leading-snug line-clamp-2 text-taupe">
              {item.name}
            </p>
          )}
          {!unavailable && (
            <span className="shrink-0 text-[15px] font-medium text-espresso tabular-nums">
              {formatPrice((item.price * item.quantity) / 100)}
            </span>
          )}
        </div>

        {unavailable ? (
          <p className="mt-1 text-sm text-destructive">
            {state.reason === "missing"
              ? "Изделие снято с продажи"
              : "Закончилось — уберите его, чтобы оформить заказ"}
          </p>
        ) : (
          meta && (
            <p className="mt-1 text-[13px] text-taupe tabular-nums">{meta}</p>
          )
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-3">
          {unavailable ? (
            <span />
          ) : (
            <fieldset className="inline-flex items-center rounded-full border border-espresso/15">
              <legend className="sr-only">Количество: {item.name}</legend>
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="size-10 sm:size-9 rounded-full flex items-center justify-center text-espresso transition-colors hover:bg-espresso/5 disabled:text-espresso/25 disabled:hover:bg-transparent"
                aria-label={`Уменьшить количество: ${item.name}`}
              >
                <MinusIcon className="size-3.5" aria-hidden="true" />
              </button>
              <output
                className="min-w-6 text-center text-sm text-espresso tabular-nums"
                aria-live="polite"
              >
                {item.quantity}
              </output>
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity + 1)}
                disabled={atLimit}
                className="size-10 sm:size-9 rounded-full flex items-center justify-center text-espresso transition-colors hover:bg-espresso/5 disabled:text-espresso/25 disabled:hover:bg-transparent"
                aria-label={`Увеличить количество: ${item.name}`}
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
              </button>
            </fieldset>
          )}
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              "-mr-2 px-2 py-2 text-[13px] underline-offset-4 transition-colors hover:underline",
              unavailable ? "text-espresso" : "text-taupe hover:text-espresso",
            )}
            aria-label={`Удалить из корзины: ${item.name}`}
          >
            Удалить
          </button>
        </div>
      </div>
    </li>
  );
}

/** Подсказка про остаток — только когда он действительно ограничивает. */
function stockHint(quantity: number, maxQuantity: number): string | null {
  if (maxQuantity >= MAX_CART_QUANTITY) return null;
  if (quantity >= maxQuantity) {
    return maxQuantity === 1
      ? "Единственное в наличии"
      : "Больше нет в наличии";
  }
  if (maxQuantity <= 3) return `Осталось ${maxQuantity} шт.`;
  return null;
}
