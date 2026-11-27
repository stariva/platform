import { getProductsResult } from "@/lib/catalog/service";
import type { Product } from "@/lib/catalog/types";
import { sellsReadyMade } from "@/lib/in-stock";
import {
  getProductMadeToOrder,
  isMadeToOrderColor,
  isMadeToOrderSize,
  PHOTO_COLOR,
  PHOTO_SIZE,
} from "@/lib/made-to-order";
import {
  MIN_NEW_YEAR_ORNAMENT_QUANTITY,
  newYearFigurinesPerItem,
  newYearSetContents,
  newYearSubcategoryFor,
} from "@/lib/new-year";
import { applyBundlePricing } from "./bundles";
import { elkaKitPrice } from "./elka-kit-price";
import {
  MAX_MADE_TO_ORDER_QUANTITY,
  type MadeToOrderOptions,
} from "./made-to-order-options";

/** Максимум одного изделия в заказе. */
export const MAX_ITEM_QUANTITY = 99;
const MAX_PRICE_KOPECKS = 2_147_483_647;

export interface RequestedCatalogItem {
  productId?: string;
  productSlug: string;
  quantity: number;
}

export interface ResolvedCatalogItem extends RequestedCatalogItem {
  ozonSku: number;
  name: string;
  price: number;
}

/**
 * Товары из корзины, которые сейчас нельзя купить: закончился остаток,
 * в корзине больше, чем осталось, товар снят с продажи или у него нет SKU
 * для Ozon Доставки. Корзина хранится
 * в браузере, поэтому такое бывает штатно — это не сбой, а повод убрать
 * товары из корзины.
 */
export class CatalogItemsUnavailableError extends Error {
  constructor(readonly productSlugs: string[]) {
    super(`catalog_product_unavailable:${productSlugs.join(",")}`);
    this.name = "CatalogItemsUnavailableError";
  }
}

/** В мгновенном новогоднем заказе слишком мало отдельных фигурок. */
export class NewYearMinimumOrderError extends Error {
  constructor(
    readonly quantity: number,
    readonly minimum = MIN_NEW_YEAR_ORNAMENT_QUANTITY,
  ) {
    super(`new_year_minimum_order:${quantity}/${minimum}`);
    this.name = "NewYearMinimumOrderError";
  }
}

/** Цена изделия в копейках; null, если её нельзя передать в Ozon Доставку. */
export function priceInKopecks(product: Product): number | null {
  const price = Math.round(product.price * 100);
  return Number.isSafeInteger(price) && price > 0 && price <= MAX_PRICE_KOPECKS
    ? price
    : null;
}

/**
 * Можно ли продать хотя бы одно изделие: есть остаток, цена в рублях и SKU
 * для Ozon Доставки, и это не одежда — её готовой не продаём.
 * Одно правило для корзины и для оформления заказа.
 */
export function isCatalogProductBuyable(product: Product | undefined): boolean {
  return Boolean(
    product?.inStock &&
      sellsReadyMade(product) &&
      (product.stockAvailable ?? 0) >= 1 &&
      product.currency === "RUB" &&
      Number.isSafeInteger(product.ozonSku) &&
      (product.ozonSku ?? 0) > 0 &&
      priceInKopecks(product) !== null,
  );
}

/**
 * Можно ли заказать изделие под заказ: оно плетётся под заказ и у него есть
 * цена в рублях. Остаток и SKU не нужны — изделие делается после оплаты.
 */
export function isMadeToOrderBuyable(product: Product | undefined): boolean {
  return Boolean(
    product &&
      getProductMadeToOrder(product) &&
      product.currency === "RUB" &&
      priceInKopecks(product) !== null,
  );
}

export interface RequestedMadeToOrderItem {
  productSlug: string;
  quantity: number;
  options: MadeToOrderOptions;
}

export interface ResolvedMadeToOrderItem extends RequestedMadeToOrderItem {
  name: string;
  /** В копейках, за единицу */
  price: number;
}

/** Размер или цвет не из тех, что предлагает карточка изделия. */
export class MadeToOrderOptionsError extends Error {
  constructor(readonly productSlug: string) {
    super(`made_to_order_invalid_options:${productSlug}`);
    this.name = "MadeToOrderOptionsError";
  }
}

/**
 * Цена и название — из каталога, размер и цвет — от покупателя, но только из
 * предложенных на карточке. Позиции с разными параметрами остаются отдельными.
 */
export async function resolveMadeToOrderItems(
  requestedItems: RequestedMadeToOrderItem[],
): Promise<ResolvedMadeToOrderItem[]> {
  const { products, status } = await getProductsResult();
  if (status === "unavailable") throw new Error("catalog_unavailable");

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const resolved: ResolvedMadeToOrderItem[] = [];
  const unavailable = new Set<string>();

  for (const item of requestedItems) {
    const product = productsBySlug.get(item.productSlug);
    const price = product ? priceInKopecks(product) : null;
    const config = product ? getProductMadeToOrder(product) : null;
    if (
      !product ||
      !config ||
      price === null ||
      !isMadeToOrderBuyable(product)
    ) {
      unavailable.add(item.productSlug);
      continue;
    }
    if (
      item.quantity > MAX_MADE_TO_ORDER_QUANTITY ||
      !isMadeToOrderSize(product, config, item.options.size) ||
      !isMadeToOrderColor(item.options.color)
    ) {
      throw new MadeToOrderOptionsError(item.productSlug);
    }
    resolved.push({
      productSlug: item.productSlug,
      quantity: item.quantity,
      name: product.name,
      price,
      options: item.options,
    });
  }

  if (unavailable.size > 0) {
    throw new CatalogItemsUnavailableError([...unavailable]);
  }
  return resolved;
}

/**
 * Изделия новогоднего конфигуратора для мгновенной оплаты. От обычных изделий
 * под заказ они отличаются тем, что производятся по фиксированному образцу:
 * размер и цвет всегда «как на фото», а посылка заранее известна. Поэтому
 * остаток и Ozon Seller SKU не нужны, но товар должен быть опубликован в
 * сезонной подкатегории (или в legacy-slug из planters, который уже показывает
 * витрина) и помечен как изготавливаемый после заказа.
 */
export async function resolveInstantMadeToOrderItems(
  requestedItems: RequestedCatalogItem[],
): Promise<ResolvedMadeToOrderItem[]> {
  const { products, status } = await getProductsResult();
  if (status === "unavailable") throw new Error("catalog_unavailable");

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const quantities = new Map<string, number>();
  for (const item of requestedItems) {
    quantities.set(
      item.productSlug,
      (quantities.get(item.productSlug) ?? 0) + item.quantity,
    );
  }
  const resolved: ResolvedMadeToOrderItem[] = [];
  const unavailable = new Set<string>();
  let figurineQuantity = 0;

  for (const [productSlug, quantity] of quantities) {
    const product = productsBySlug.get(productSlug);
    const price = product ? priceInKopecks(product) : null;
    if (
      !product ||
      requestedItems.some(
        (item) =>
          item.productSlug === productSlug &&
          item.productId &&
          item.productId !== product.id,
      ) ||
      price === null ||
      !product.madeToOrder ||
      !newYearSubcategoryFor(product) ||
      quantity > MAX_MADE_TO_ORDER_QUANTITY
    ) {
      unavailable.add(productSlug);
      continue;
    }
    const subcategory = newYearSubcategoryFor(product);
    if (subcategory === "ornaments") {
      figurineQuantity += quantity;
    } else if (subcategory === "ornament_sets") {
      figurineQuantity += quantity * newYearFigurinesPerItem(productSlug);
    }
    const contents =
      subcategory === "ornament_sets" ? newYearSetContents(productSlug) : [];
    resolved.push({
      productSlug,
      quantity,
      name: product.name,
      price,
      options: {
        size: PHOTO_SIZE,
        color: PHOTO_COLOR,
        measurements: [],
        ...(contents.length > 0 ? { contents } : {}),
      },
    });
  }

  if (unavailable.size > 0) {
    throw new CatalogItemsUnavailableError([...unavailable]);
  }
  if (figurineQuantity < MIN_NEW_YEAR_ORNAMENT_QUANTITY) {
    throw new NewYearMinimumOrderError(figurineQuantity);
  }
  return resolved;
}

/** Resolves all price and fulfillment data from the server-side catalog. */
export async function resolveCatalogItems(
  requestedItems: RequestedCatalogItem[],
  options: { elkaKitOwner?: boolean } = {},
): Promise<ResolvedCatalogItem[]> {
  const { products, status } = await getProductsResult();
  // Каталог недоступен — это сбой, а не отсутствие товаров: иначе
  // покупателю пришлось бы очистить всю корзину.
  if (status === "unavailable") throw new Error("catalog_unavailable");

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const quantities = new Map<string, number>();

  for (const item of requestedItems) {
    const quantity = (quantities.get(item.productSlug) ?? 0) + item.quantity;
    if (quantity > MAX_ITEM_QUANTITY)
      throw new Error("catalog_quantity_too_large");
    quantities.set(item.productSlug, quantity);
  }

  const resolved: ResolvedCatalogItem[] = [];
  const unavailable: string[] = [];
  for (const [productSlug, quantity] of quantities) {
    const product = productsBySlug.get(productSlug);
    const price = product ? priceInKopecks(product) : null;
    if (
      !product ||
      requestedItems.some(
        (item) =>
          item.productSlug === productSlug &&
          item.productId &&
          item.productId !== product.id,
      ) ||
      price === null ||
      !isCatalogProductBuyable(product) ||
      quantity > product.stockAvailable
    ) {
      unavailable.push(productSlug);
      continue;
    }

    resolved.push({
      productSlug,
      quantity,
      ozonSku: product.ozonSku as number,
      name: product.name,
      price,
    });
  }

  if (unavailable.length > 0) {
    throw new CatalogItemsUnavailableError(unavailable);
  }
  // Цены комплектов считает сервер: сумма заказа и платёж берутся отсюда
  return applyBundlePricing(resolved).map((item) => ({
    ...item,
    price: elkaKitPrice(
      item.productSlug,
      item.price,
      options.elkaKitOwner ?? false,
    ),
  }));
}
