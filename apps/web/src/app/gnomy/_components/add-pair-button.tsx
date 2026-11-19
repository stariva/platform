"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import { MAX_CART_QUANTITY, useCart } from "@/lib/cart/cart-context";
import type { Product } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

/**
 * Кладёт в корзину всё, что есть в наличии, и ведёт к оформлению: пара —
 * один заказ и одна доставка. Тем, что уже лежит в корзине, количество не
 * наращиваем: готовое изделие единственное.
 */
export function AddPairButton({
  products,
  label,
  goal,
  className,
}: {
  /** Только то, что можно купить сейчас. */
  products: Product[];
  label: string;
  /** Цель Метрики: откуда нажали — из первого экрана или из блока оффера. */
  goal: string;
  className?: string;
}) {
  const { add, items } = useCart();
  const router = useRouter();

  if (products.length === 0) return null;

  return (
    <Button
      type="button"
      onClick={() => {
        const added: Product[] = [];
        for (const product of products) {
          const inCart =
            items.find(
              (item) =>
                item.fulfillmentType === "stock" &&
                item.productSlug === product.slug,
            )?.quantity ?? 0;
          if (inCart >= Math.min(product.stockAvailable, MAX_CART_QUANTITY)) {
            continue;
          }
          add({
            productSlug: product.slug,
            fulfillmentType: "stock",
            ozonSku: product.ozonSku as number,
            name: product.name,
            image: product.images[0] ?? "",
            price: Math.round(product.price * 100),
          });
          added.push(product);
        }
        if (added.length > 0) {
          trackProductEvent(
            "add",
            added.map((product) => ({
              id: product.slug,
              name: product.name,
              price: product.price,
              quantity: 1,
              category: product.category,
            })),
          );
          reachGoal("add_to_cart", { product_id: added[0]?.slug });
        }
        reachGoal(goal, { count: added.length });
        router.push("/cart");
      }}
      className={cn(
        "inline-flex h-auto items-center justify-center rounded-2xl bg-terracotta px-8 py-4 text-base text-parchment transition-colors hover:bg-terracotta-dark",
        className,
      )}
    >
      {label}
    </Button>
  );
}
