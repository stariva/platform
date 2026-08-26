"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import type { Product } from "@/lib/ozon-types";

export function AddToCartButton({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (!product.ozonSku || !product.inStock) return null;

  return (
    <Button
      type="button"
      onClick={() => {
        add({
          productSlug: product.slug,
          ozonSku: product.ozonSku as number,
          name: product.name,
          image: product.images[0] ?? "",
          price: Math.round(product.price * 100),
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className={
        className ??
        "flex items-center justify-center gap-2 w-full bg-espresso hover:bg-terracotta text-white py-4 h-auto rounded-2xl transition-colors label-caps"
      }
    >
      {added ? "Добавлено ✓" : "В корзину"}
    </Button>
  );
}
