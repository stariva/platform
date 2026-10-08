"use client";

import { WorkshopPurchase } from "@/app/workshops/[slug]/workshop-purchase";
import { reachGoal } from "@/lib/analytics";
import { formatPrice } from "@/lib/workshops-data";
import { LANDING_PATH } from "../_data";

export function WorkshopPreorderButton({
  slug,
  price,
  title,
}: {
  slug: string;
  price: number;
  title: string;
}) {
  return (
    <WorkshopPurchase
      slug={slug}
      price={price}
      title={title}
      returnPath={`${LANDING_PATH}#workshop`}
      buyLabel={`Оформить предзаказ за ${formatPrice(price)}`}
      onBuyClick={() => reachGoal("elka_workshop_preorder", { price })}
    />
  );
}
