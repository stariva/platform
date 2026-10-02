"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import { MAX_CART_QUANTITY, useCart } from "@/lib/cart/cart-context";
import { isPurchasable } from "@/lib/in-stock";
import type { Product } from "@/lib/ozon-types";

/**
 * Добавляет изделие в корзину, отправляет аналитику и показывает подтверждение.
 * Возвращает null, если у товара нет свободного остатка или SKU Ozon.
 */
export function AddToCartButton({
  product,
  className,
  label = "В корзину",
}: {
  product: Product;
  className?: string;
  label?: string;
}) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);

  if (!isPurchasable(product)) return null;

  const inCart =
    items.find(
      (item) =>
        item.fulfillmentType === "stock" && item.productSlug === product.slug,
    )?.quantity ?? 0;
  const limit = Math.min(product.stockAvailable, MAX_CART_QUANTITY);
  const buttonClassName =
    className ??
    "flex items-center justify-center gap-2 w-full bg-espresso hover:bg-terracotta text-white py-4 h-auto rounded-2xl transition-colors label-caps";

  // Весь остаток уже в корзине — класть больше нечего, ведём к оформлению
  if (inCart >= limit) {
    return (
      <Button asChild className={buttonClassName}>
        <Link href="/cart">
          {limit === 1 ? "В корзине — перейти" : "Весь остаток в корзине"}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => {
        add({
          productSlug: product.slug,
          fulfillmentType: "stock",
          ozonSku: product.ozonSku as number,
          name: product.name,
          image: product.images[0] ?? "",
          price: Math.round(product.price * 100),
        });
        trackProductEvent("add", [
          {
            id: product.slug,
            name: product.name,
            price: product.price,
            quantity: 1,
            category: product.category,
          },
        ]);
        reachGoal("add_to_cart", { product_id: product.slug });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className={buttonClassName}
    >
      {added ? "Добавлено ✓" : label}
    </Button>
  );
}
