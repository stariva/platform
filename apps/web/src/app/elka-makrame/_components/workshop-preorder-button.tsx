"use client";

import { WorkshopPurchase } from "@/app/workshops/[slug]/workshop-purchase";
import { reachGoal } from "@/lib/analytics";
import { WORKSHOP_PATH } from "@/lib/elka/data";
import { formatPrice } from "@/lib/workshops-data";
import { WORKSHOP_SECTION_ID } from "../_data";

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
      returnPath={`${WORKSHOP_PATH}#${WORKSHOP_SECTION_ID}`}
      preorder
      buyLabel={`Оформить предзаказ за ${formatPrice(price)}`}
      onBuyClick={() => reachGoal("elka_workshop_preorder", { price })}
    />
  );
}
