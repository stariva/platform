"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import { useCart } from "@/lib/cart/cart-context";
import type { Product } from "@/lib/catalog/types";
import { ELKA_KIT_OWNER_PRICE_KOPECKS } from "@/lib/commerce/elka-kit-price";
import { formatPrice } from "@/lib/products";

export function ElkaKitBuyButton({ product }: { product: Product }) {
  const { add, items } = useCart();
  const router = useRouter();
  const inCart = items.some(
    (item) =>
      item.fulfillmentType === "stock" && item.productSlug === product.slug,
  );
  const price = Math.min(
    Math.round(product.price * 100),
    ELKA_KIT_OWNER_PRICE_KOPECKS,
  );

  return (
    <button
      type="button"
      onClick={() => {
        if (!inCart) {
          add({
            productSlug: product.slug,
            fulfillmentType: "stock",
            ozonSku: product.ozonSku as number,
            name: product.name,
            image: product.images[0] ?? "",
            price,
            kit: true,
          });
          trackProductEvent("add", [
            {
              id: product.slug,
              name: product.name,
              price: price / 100,
              quantity: 1,
              category: product.category,
            },
          ]);
        }
        reachGoal("account_elka_kit_offer", { product_id: product.slug });
        router.push("/cart");
      }}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-5 py-3 text-center font-medium text-parchment transition-colors hover:bg-terracotta-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta sm:w-auto"
    >
      {inCart ? "Перейти к заказу" : `Купить набор за ${formatPrice(price / 100)}`}
      <ArrowRight className="size-4 shrink-0" aria-hidden />
    </button>
  );
}
