import { NextResponse } from "next/server";
import type { CatalogItemsUnavailableError } from "./catalog";

/** 409 со списком товаров, которые checkout убирает из корзины. */
export function unavailableItemsResponse(
  error: CatalogItemsUnavailableError,
  message = "Некоторых товаров из корзины уже нет в наличии",
) {
  console.warn("[checkout] Товары недоступны:", error.productSlugs);
  return NextResponse.json(
    { error: message, unavailableProductSlugs: error.productSlugs },
    { status: 409 },
  );
}
