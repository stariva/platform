import { NextResponse } from "next/server";
import type { CatalogItemsUnavailableError } from "./catalog";

/** 409 со списком товаров, которые checkout убирает из корзины. */
export function unavailableItemsResponse(error: CatalogItemsUnavailableError) {
  console.warn("[checkout] Товары недоступны:", error.productSlugs);
  return NextResponse.json(
    {
      error: "Некоторых товаров из корзины уже нет в наличии",
      unavailableProductSlugs: error.productSlugs,
    },
    { status: 409 },
  );
}
