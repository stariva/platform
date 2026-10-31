/**
 * Комплекты готовых изделий: цена комплекта ниже суммы цен по отдельности.
 * Без серверных зависимостей — одну и ту же функцию зовут корзина в браузере
 * и сервер при оформлении заказа, поэтому покупатель видит ту же сумму, что
 * потом оплачивает.
 */

/**
 * Комплект гномов. Slug товара — название с Ozon и последние четыре цифры
 * Ozon ID: название меняется, хвост остаётся.
 */
export const GNOME_TAILS = ["-9563", "-0554"] as const;
/** Цена двух гномов вместе, в копейках. По отдельности — по цене в каталоге. */
export const GNOME_PAIR_PRICE_KOPECKS = 650_000;

interface BundleItem {
  productSlug: string;
  quantity: number;
  /** В копейках, за единицу */
  price: number;
  /** Нет у изделий из каталога без поля: считаем готовым. */
  fulfillmentType?: "stock" | "made_to_order";
}

export type WithListPrice<T> = T & {
  /** Цена без скидки за комплект, в копейках; есть только у изделий в комплекте. */
  listPrice?: number;
};

export function isGnomeSlug(slug: string): boolean {
  return GNOME_TAILS.some((tail) => slug.endsWith(tail));
}

/**
 * Цены с учётом комплектов. Оба гнома по одному в корзине — скидка делится
 * между ними, чтобы суммы позиций (и чека ЮKassa) сходились до копейки.
 * Изделие в корзине единственное; если в корзине их больше, комплект не
 * считаем — цена за единицу у позиции одна, поровну скидку не разделить.
 */
export function applyBundlePricing<T extends BundleItem>(
  items: T[],
): WithListPrice<T>[] {
  const [first, second] = GNOME_TAILS.map((tail) =>
    items.filter(
      (item) =>
        (item.fulfillmentType ?? "stock") === "stock" &&
        item.productSlug.endsWith(tail),
    ),
  );
  const a = first?.length === 1 ? first[0] : undefined;
  const b = second?.length === 1 ? second[0] : undefined;
  if (!a || !b || a.quantity !== 1 || b.quantity !== 1) return items;

  const discount = a.price + b.price - GNOME_PAIR_PRICE_KOPECKS;
  if (discount <= 0) return items;

  const cutA = Math.floor(discount / 2);
  const cutB = discount - cutA;
  return items.map((item) => {
    if (item === a)
      return { ...item, price: item.price - cutA, listPrice: a.price };
    if (item === b)
      return { ...item, price: item.price - cutB, listPrice: b.price };
    return item;
  });
}

/** Сколько комплект экономит в корзине, в копейках. */
export function bundleSavingKopecks(
  items: WithListPrice<BundleItem>[],
): number {
  return items.reduce(
    (sum, item) =>
      sum + ((item.listPrice ?? item.price) - item.price) * item.quantity,
    0,
  );
}
