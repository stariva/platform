import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import type { ProductsResult } from "@/lib/catalog/service";
import type { Product } from "@/lib/catalog/types";

const product: Product = {
  id: "ozon-1",
  slug: "tunika-5565",
  name: "Туника",
  description: "",
  shortDescription: "",
  price: 3500,
  currency: "RUB",
  images: [],
  category: "clothes",
  subcategory: "tops",
  ozonSku: 3723160127,
  inStock: true,
  stockAvailable: 5,
  madeToOrder: true,
  material: "",
  featured: false,
};

// Готовым со склада продаём всё, кроме одежды
const bag: Product = {
  ...product,
  id: "ozon-2",
  slug: "avoska-5566",
  name: "Авоська",
  category: "bags",
  subcategory: "totes",
};

let catalog: ProductsResult = { products: [], status: "available" };

// Подменяем слой базы, а не весь service: mock.module в bun глобален для прогона,
// и урезанный service ломал бы другие тесты, которым нужны getProducts и т. д.
mock.module("@/lib/catalog/products-db", () => ({
  fetchPublishedProducts: async () => {
    if (catalog.status === "unavailable") throw new Error("db_unavailable");
    return catalog.products;
  },
}));
mock.module("@/lib/catalog/reviews-db", () => ({
  fetchPublishedReviews: async () => [],
}));

const {
  CatalogItemsUnavailableError,
  isCatalogProductBuyable,
  isMadeToOrderBuyable,
  MadeToOrderOptionsError,
  NewYearMinimumOrderError,
  resolveCatalogItems,
  resolveInstantMadeToOrderItems,
  resolveMadeToOrderItems,
} = await import("./catalog");

test("resolves in-stock items with kopeck prices", async () => {
  catalog = { products: [bag], status: "available" };

  const items = await resolveCatalogItems([
    { productSlug: bag.slug, quantity: 1 },
    { productSlug: bag.slug, quantity: 2 },
  ]);

  assert.deepEqual(items, [
    {
      productSlug: bag.slug,
      quantity: 3,
      ozonSku: 3723160127,
      name: "Авоська",
      price: 350000,
    },
  ]);
});

test("charges 990 ₽ for every tree kit color only to a buyer of its workshop", async () => {
  const kit: Product = {
    ...bag,
    id: "elka-kit",
    slug: "nabor-makrame-elka",
    category: "interior",
    subcategory: "kits",
    price: 1980,
  };
  const beigeKit: Product = {
    ...kit,
    id: "elka-kit-beige",
    slug: "nabor-makrame-elka-bezhevyy",
  };
  catalog = { products: [kit, beigeKit, bag], status: "available" };
  const requested = [
    { productSlug: kit.slug, quantity: 1 },
    { productSlug: beigeKit.slug, quantity: 1 },
    { productSlug: bag.slug, quantity: 1 },
  ];

  const regular = await resolveCatalogItems(requested);
  const owner = await resolveCatalogItems(requested, { elkaKitOwner: true });

  assert.deepEqual(
    regular.map((item) => item.price),
    [198_000, 198_000, 350_000],
  );
  assert.deepEqual(
    owner.map((item) => item.price),
    [99_000, 99_000, 350_000],
  );
});

test("both gnomes together are charged the bundle price, one alone the catalog price", async () => {
  const gnome = (slug: string, sku: number): Product => ({
    ...bag,
    id: slug,
    slug,
    name: slug,
    price: 3700,
    stockAvailable: 1,
    ozonSku: sku,
  });
  catalog = {
    products: [gnome("gnom-tykva-9563", 1), gnome("gnom-mukhomor-0554", 2)],
    status: "available",
  };

  const both = await resolveCatalogItems([
    { productSlug: "gnom-tykva-9563", quantity: 1 },
    { productSlug: "gnom-mukhomor-0554", quantity: 1 },
  ]);
  assert.equal(
    both.reduce((sum, item) => sum + item.price * item.quantity, 0),
    630000,
  );

  const one = await resolveCatalogItems([
    { productSlug: "gnom-tykva-9563", quantity: 1 },
  ]);
  assert.equal(one[0]?.price, 370000);
});

test("reports every sold-out or missing item at once", async () => {
  catalog = {
    products: [bag, { ...bag, slug: "sold-out", inStock: false }],
    status: "available",
  };

  const error = await resolveCatalogItems([
    { productSlug: bag.slug, quantity: 1 },
    { productSlug: "sold-out", quantity: 1 },
    { productSlug: "delisted", quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, ["sold-out", "delisted"]);
});

test("does not sell ready-made clothes from stock", async () => {
  catalog = { products: [product], status: "available" };

  const error = await resolveCatalogItems([
    { productSlug: product.slug, quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, [product.slug]);
});

test("rejects a quantity larger than the remaining stock", async () => {
  catalog = { products: [bag], status: "available" };

  const error = await resolveCatalogItems([
    { productSlug: bag.slug, quantity: 6 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, [bag.slug]);
});

test("treats a catalog outage as a failure, not as sold-out items", async () => {
  catalog = { products: [], status: "unavailable" };

  const error = await resolveCatalogItems([
    { productSlug: bag.slug, quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof Error);
  assert.ok(!(error instanceof CatalogItemsUnavailableError));
  assert.equal(error.message, "catalog_unavailable");
});

test("a product is buyable only with stock, RUB price and an Ozon SKU, and not clothes", () => {
  assert.equal(isCatalogProductBuyable(bag), true);
  assert.equal(isCatalogProductBuyable(product), false);
  assert.equal(isCatalogProductBuyable(undefined), false);
  assert.equal(isCatalogProductBuyable({ ...bag, inStock: false }), false);
  assert.equal(isCatalogProductBuyable({ ...bag, stockAvailable: 0 }), false);
  assert.equal(isCatalogProductBuyable({ ...bag, ozonSku: undefined }), false);
  assert.equal(isCatalogProductBuyable({ ...bag, currency: "USD" }), false);
  assert.equal(isCatalogProductBuyable({ ...bag, price: 0 }), false);
});

const sold: Product = { ...product, inStock: false, stockAvailable: 0 };
const toOrder = (overrides: Record<string, unknown> = {}) => ({
  productSlug: product.slug,
  quantity: 1,
  options: {
    size: "M",
    color: "Бежевый",
    measurements: [] as { label: string; value: string }[],
  },
  ...overrides,
});

test("made-to-order items need no stock or Ozon SKU, only price and the flag", async () => {
  catalog = {
    products: [{ ...sold, ozonSku: undefined }],
    status: "available",
  };

  const items = await resolveMadeToOrderItems([toOrder()]);

  assert.deepEqual(items, [
    {
      productSlug: product.slug,
      quantity: 1,
      name: "Туника",
      price: 350000,
      options: { size: "M", color: "Бежевый", measurements: [] },
    },
  ]);
});

test("made-to-order lines with different options stay separate", async () => {
  catalog = { products: [sold], status: "available" };

  const items = await resolveMadeToOrderItems([
    toOrder(),
    toOrder({ options: { size: "По меркам", color: "Как на фото" } }),
  ]);

  assert.equal(items.length, 2);
});

test("made-to-order rejects products that are not woven to order", async () => {
  catalog = {
    products: [{ ...sold, madeToOrder: false }],
    status: "available",
  };

  const error = await resolveMadeToOrderItems([toOrder()]).catch(
    (e: unknown) => e,
  );

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, [product.slug]);
});

test("made-to-order rejects a size or color the product page does not offer", async () => {
  catalog = { products: [sold], status: "available" };

  for (const options of [
    { size: "XXXL", color: "Бежевый" },
    { size: "M", color: "Ядовито-зелёный" },
  ]) {
    const error = await resolveMadeToOrderItems([toOrder({ options })]).catch(
      (e: unknown) => e,
    );
    assert.ok(error instanceof MadeToOrderOptionsError);
  }
});

test("made-to-order accepts custom-size labels per category", async () => {
  catalog = {
    products: [sold, { ...sold, slug: "bag", category: "bags" }],
    status: "available",
  };

  const items = await resolveMadeToOrderItems([
    toOrder({ options: { size: "По меркам", color: "Молочный" } }),
    toOrder({
      productSlug: "bag",
      options: { size: "Свой размер", color: "Молочный" },
    }),
  ]);

  assert.equal(items.length, 2);
});

test("made-to-order caps the quantity of one line", async () => {
  catalog = { products: [sold], status: "available" };

  const error = await resolveMadeToOrderItems([
    toOrder({ quantity: 11 }),
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof MadeToOrderOptionsError);
});

test("a product is orderable to measure with a RUB price and the flag", () => {
  assert.equal(isMadeToOrderBuyable(sold), true);
  assert.equal(isMadeToOrderBuyable(undefined), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, madeToOrder: false }), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, currency: "USD" }), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, price: 0 }), false);
});

const newYearShar = (overrides: Partial<Product> = {}): Product => ({
  ...sold,
  id: "new-year-shar",
  slug: "novogodnee-ukrashenie-shar",
  name: "Цветочный шар",
  category: "interior",
  subcategory: "ornaments",
  ozonSku: undefined,
  madeToOrder: true,
  price: 490,
  ...overrides,
});

test("instant made-to-order items need only a seasonal product with a price", async () => {
  catalog = { products: [newYearShar()], status: "available" };

  const items = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodnee-ukrashenie-shar", quantity: 7 },
  ]);

  assert.deepEqual(items, [
    {
      productSlug: "novogodnee-ukrashenie-shar",
      quantity: 7,
      name: "Цветочный шар",
      price: 49000,
      options: { size: "Как на фото", color: "Как на фото", measurements: [] },
    },
  ]);
});

test("instant made-to-order accepts the legacy planters slugs shown by the configurator", async () => {
  catalog = {
    products: [newYearShar({ subcategory: "planters" })],
    status: "available",
  };

  const items = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodnee-ukrashenie-shar", quantity: 7 },
  ]);

  assert.equal(items.length, 1);
});

test("instant made-to-order requires at least seven physical figurines", async () => {
  catalog = { products: [newYearShar()], status: "available" };

  const error = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodnee-ukrashenie-shar", quantity: 6 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof NewYearMinimumOrderError);
  assert.equal(error.minimum, 7);
  assert.equal(error.quantity, 6);
});

test("instant made-to-order counts ornaments across lines and still allows fixed sets alone", async () => {
  const bell = newYearShar({
    id: "new-year-bell",
    slug: "novogodnee-ukrashenie-bell",
    name: "Колокольчик",
  });
  const winterSet = newYearShar({
    id: "new-year-winter-set",
    slug: "novogodniy-nabor-zimniy-uyut",
    name: "Зимний уют",
    subcategory: "ornament_sets",
  });
  catalog = { products: [newYearShar(), bell, winterSet], status: "available" };

  const items = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodnee-ukrashenie-shar", quantity: 3 },
    { productSlug: "novogodnee-ukrashenie-bell", quantity: 4 },
  ]);
  assert.equal(items.length, 2);

  const setOnly = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodniy-nabor-zimniy-uyut", quantity: 1 },
  ]);
  assert.equal(setOnly.length, 1);
  assert.deepEqual(setOnly[0]?.options.contents, [
    { name: "Снежинка", quantity: 1 },
    { name: "Варежка", quantity: 1 },
    { name: "Колокольчик", quantity: 1 },
    { name: "Звезда", quantity: 1 },
    { name: "Домик", quantity: 1 },
    { name: "Самовар", quantity: 1 },
    { name: "Баранка", quantity: 1 },
  ]);

  const setWithExtraOrnament = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodniy-nabor-zimniy-uyut", quantity: 1 },
    { productSlug: "novogodnee-ukrashenie-shar", quantity: 1 },
  ]);
  assert.equal(setWithExtraOrnament.length, 2);
});

test("instant made-to-order does not sell packaging without figurines", async () => {
  catalog = {
    products: [
      newYearShar({
        id: "new-year-box",
        slug: "novogodnyaya-podarochnaya-korobka",
        name: "Подарочная коробка",
        subcategory: "gift_boxes",
      }),
    ],
    status: "available",
  };

  const error = await resolveInstantMadeToOrderItems([
    { productSlug: "novogodnyaya-podarochnaya-korobka", quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof NewYearMinimumOrderError);
  assert.equal(error.quantity, 0);
});

test("instant made-to-order rejects other custom products", async () => {
  catalog = {
    products: [newYearShar({ slug: "tunika-5565", subcategory: "planters" })],
    status: "available",
  };

  const error = await resolveInstantMadeToOrderItems([
    { productSlug: "tunika-5565", quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, ["tunika-5565"]);
});
