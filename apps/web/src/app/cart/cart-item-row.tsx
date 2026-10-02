"use client";

import { ImageOffIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
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

  const thumb = (
    <div
      className={cn(
        "relative size-20 sm:size-24 rounded-xl overflow-hidden bg-sand",
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
    <li className="flex gap-4 p-4 sm:p-5">
      {linkable ? (
        <Link href={productHref} className="shrink-0" tabIndex={-1}>
          {thumb}
        </Link>
      ) : (
        <div className="shrink-0">{thumb}</div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {linkable ? (
              <Link
                href={productHref}
                className={cn(
                  "font-medium leading-snug line-clamp-2 transition-colors hover:text-terracotta",
                  unavailable ? "text-taupe" : "text-espresso",
                )}
              >
                {item.name}
              </Link>
            ) : (
              <p className="font-medium leading-snug line-clamp-2 text-taupe">
                {item.name}
              </p>
            )}
            {unavailable ? (
              <p className="mt-1 text-sm text-destructive">
                {state.reason === "missing"
                  ? "Изделие снято с продажи"
                  : "Нет в наличии"}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-taupe tabular-nums">
                {formatPrice(item.price / 100)}
                {item.quantity > 1 && " за шт."}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="-m-2 p-2 rounded-full text-taupe hover:text-terracotta hover:bg-espresso/5 transition-colors"
            aria-label={`Удалить из корзины: ${item.name}`}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
          </button>
        </div>

        {unavailable ? (
          <p className="text-sm text-taupe">
            Уберите изделие из корзины, чтобы оформить заказ.
          </p>
        ) : (
          <div className="mt-auto flex items-end justify-between gap-3">
            <div>
              <fieldset className="inline-flex items-center rounded-full border border-espresso/15">
                <legend className="sr-only">Количество: {item.name}</legend>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="size-10 sm:size-9 rounded-full flex items-center justify-center text-espresso transition-colors hover:bg-espresso/5 disabled:text-espresso/30 disabled:hover:bg-transparent"
                  aria-label={`Уменьшить количество: ${item.name}`}
                >
                  <MinusIcon className="size-3.5" aria-hidden="true" />
                </button>
                <output
                  className="min-w-7 text-center text-sm text-espresso tabular-nums"
                  aria-live="polite"
                >
                  {item.quantity}
                </output>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity + 1)}
                  disabled={atLimit}
                  className="size-10 sm:size-9 rounded-full flex items-center justify-center text-espresso transition-colors hover:bg-espresso/5 disabled:text-espresso/30 disabled:hover:bg-transparent"
                  aria-label={`Увеличить количество: ${item.name}`}
                >
                  <PlusIcon className="size-3.5" aria-hidden="true" />
                </button>
              </fieldset>
              <StockHint quantity={item.quantity} maxQuantity={maxQuantity} />
            </div>
            <span className="text-espresso font-medium tabular-nums">
              {formatPrice((item.price * item.quantity) / 100)}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function StockHint({
  quantity,
  maxQuantity,
}: {
  quantity: number;
  maxQuantity: number;
}) {
  if (maxQuantity >= MAX_CART_QUANTITY) return null;
  if (quantity >= maxQuantity) {
    return (
      <p className="mt-1.5 text-xs text-taupe">
        {maxQuantity === 1
          ? "Единственное изделие в наличии"
          : "Больше нет в наличии"}
      </p>
    );
  }
  if (maxQuantity <= 3) {
    return (
      <p className="mt-1.5 text-xs text-taupe">Осталось {maxQuantity} шт.</p>
    );
  }
  return null;
}
