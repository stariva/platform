import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { cartValidationResponseSchema } from "@/lib/cart/validation";
import type { ProductsResult } from "@/lib/catalog/service";
import type { Product } from "@/lib/catalog/types";
import { priceKitBundleLines } from "@/lib/commerce/elka-kit-bundle";

const product: Product = {
  id: "ozon-1",
  slug: "avoska-5565",
  name: "Авоська",
  description: "",
  shortDescription: "",
  price: 3500,
  currency: "RUB",
  images: ["https://cdn.stariva.ru/a.jpg"],
  category: "bags",
  subcategory: "totes",
  ozonSku: 3723160127,
  inStock: true,
  stockAvailable: 150,
  madeToOrder: true,
  material: "",
  featured: false,
};

let catalog: ProductsResult = { products: [], status: "available" };
let signedIn = false;
let eligible = false;

mock.module("@/lib/auth/session", () => ({
  getSession: async () => (signedIn ? { user: { id: "course-owner" } } : null),
}));
mock.module("@/lib/commerce/elka-kit-offer", () => ({
  hasPurchasedElkaWorkshop: async () => eligible,
}));

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

const { POST } = await import("./route");

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/cart/validate", {
    method: "POST",
    body: JSON.stringify(body),
  });

const stock = (productSlug: string) => ({
  productSlug,
  fulfillmentType: "stock",
});
const madeToOrder = (productSlug: string) => ({
  productSlug,
  fulfillmentType: "made_to_order",
});

test("returns fresh price and capped stock for buyable products", async () => {
  catalog = { products: [product], status: "available" };

  const res = await POST(
    request({ lines: [stock(product.slug), stock(product.slug)] }),
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    lines: [
      {
        productSlug: product.slug,
        fulfillmentType: "stock",
        available: true,
        name: "Авоська",
        image: "https://cdn.stariva.ru/a.jpg",
        ozonSku: 3723160127,
        price: 350000,
        maxQuantity: 99,
      },
    ],
  });
});

test("marks a kit, so a cart from before the gift option still offers it", async () => {
  catalog = {
    products: [{ ...product, category: "interior", subcategory: "kits" }],
    status: "available",
  };

  const res = await POST(request({ lines: [stock(product.slug)] }));

  const { lines } = (await res.json()) as { lines: { kit?: boolean }[] };
  assert.equal(lines[0]?.kit, true);
});

test("shows the owner price for the tree kit only with a purchased course", async () => {
  catalog = {
    products: [
      {
        ...product,
        slug: "nabor-makrame-elka",
        category: "interior",
        subcategory: "kits",
        price: 1980,
      },
    ],
    status: "available",
  };
  signedIn = true;
  eligible = true;
  const owner = await POST(request({ lines: [stock("nabor-makrame-elka")] }));
  const ownerLines = (await owner.json()) as { lines: { price: number }[] };
  assert.equal(ownerLines.lines[0]?.price, 98_000);

  signedIn = false;
  const guest = await POST(request({ lines: [stock("nabor-makrame-elka")] }));
  const guestLines = (await guest.json()) as { lines: { price: number }[] };
  assert.equal(guestLines.lines[0]?.price, 198_000);
  eligible = false;
});

test("validates two separately gifted kits at the bundle price for a course owner", async () => {
  const slug = "nabor-makrame-elka";
  catalog = {
    products: [
      {
        ...product,
        slug,
        category: "interior",
        subcategory: "kits",
        price: 1980,
      },
    ],
    status: "available",
  };
  signedIn = true;
  eligible = true;
  try {
    const mode = "separate_gifts";
    const response = await POST(
      request({ lines: [stock(slug)], kitAccessMode: mode }),
    );
    assert.equal(response.status, 200);
    const { lines } = cartValidationResponseSchema.parse(await response.json());
    const [item] = lines;
    assert.ok(item?.available);
    assert.equal(item.price, 198_000);
    const priced = priceKitBundleLines([{ ...item, quantity: 2 }], mode);
    assert.equal(priced?.[0]?.price, 189_000);
  } finally {
    signedIn = false;
    eligible = false;
  }
});

test("ready-made clothes from an old cart are no longer for sale", async () => {
  catalog = {
    products: [{ ...product, category: "clothes", subcategory: "tops" }],
    status: "available",
  };

  const res = await POST(request({ lines: [stock(product.slug)] }));

  assert.deepEqual(await res.json(), {
    lines: [
      {
        productSlug: product.slug,
        fulfillmentType: "stock",
        available: false,
        reason: "sold_out",
      },
    ],
  });
});

test("tells sold-out products from missing ones", async () => {
  catalog = {
    products: [{ ...product, inStock: false, stockAvailable: 0 }],
    status: "available",
  };

  const res = await POST(
    request({ lines: [stock(product.slug), stock("gone")] }),
  );

  assert.deepEqual(await res.json(), {
    lines: [
      {
        productSlug: product.slug,
        fulfillmentType: "stock",
        available: false,
        reason: "sold_out",
      },
      {
        productSlug: "gone",
        fulfillmentType: "stock",
        available: false,
        reason: "missing",
      },
    ],
  });
});

test("made-to-order lines ignore stock and keep a separate line", async () => {
  catalog = {
    products: [{ ...product, inStock: false, stockAvailable: 0 }],
    status: "available",
  };

  const res = await POST(
    request({ lines: [stock(product.slug), madeToOrder(product.slug)] }),
  );

  assert.deepEqual(await res.json(), {
    lines: [
      {
        productSlug: product.slug,
        fulfillmentType: "stock",
        available: false,
        reason: "sold_out",
      },
      {
        productSlug: product.slug,
        fulfillmentType: "made_to_order",
        available: true,
        name: "Авоська",
        image: "https://cdn.stariva.ru/a.jpg",
        price: 350000,
        maxQuantity: 10,
      },
    ],
  });
});

test("made-to-order line carries the product's own lead time", async () => {
  catalog = {
    products: [{ ...product, leadTimeDays: { min: 5, max: 7 } }],
    status: "available",
  };

  const res = await POST(request({ lines: [madeToOrder(product.slug)] }));
  const { lines } = (await res.json()) as {
    lines: { leadTimeDays?: { min: number; max: number } }[];
  };

  assert.deepEqual(lines[0]?.leadTimeDays, { min: 5, max: 7 });
});

test("reports a catalog outage instead of marking everything missing", async () => {
  catalog = { products: [], status: "unavailable" };

  assert.equal(
    (await POST(request({ lines: [stock(product.slug)] }))).status,
    503,
  );
});

test("rejects a malformed body", async () => {
  assert.equal((await POST(request({ lines: [] }))).status, 400);
  assert.equal((await POST(request({ slugs: [product.slug] }))).status, 400);
  assert.equal((await POST(request({}))).status, 400);
});
