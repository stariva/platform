"use client";

import { WorkshopPurchase } from "@/app/workshops/[slug]/workshop-purchase";
import { reachGoal } from "@/lib/analytics";
import { WORKSHOP_PATH } from "@/lib/elka/data";
import { formatPrice } from "@/lib/workshops-data";
import { WORKSHOP_SECTION_ID } from "../_data";

/**
 * Оплата мастер-класса на странице ёлки. Цель аналитики одна и та же до и
 * после старта, чтобы не рвать статистику кампании.
 */
export function WorkshopPreorderButton({
  slug,
  price,
  title,
  preorder,
  goal = "elka_workshop_preorder",
}: {
  slug: string;
  price: number;
  title: string;
  preorder: boolean;
  goal?: string;
}) {
  return (
    <WorkshopPurchase
      slug={slug}
      price={price}
      title={title}
      returnPath={`${WORKSHOP_PATH}#${WORKSHOP_SECTION_ID}`}
      preorder={preorder}
      buyLabel={`${preorder ? "Оформить предзаказ" : "Купить"} за ${formatPrice(price)}`}
      onBuyClick={() => reachGoal(goal, { price })}
    />
  );
}
