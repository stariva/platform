import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { ProductsResult } from "@/lib/ozon-service";
import type { Product } from "@/lib/ozon-types";

const product: Product = {
  id: "ozon-1",
  slug: "tunika-5565",
  name: "Туника",
  description: "",
  shortDescription: "",
  price: 3500,
  currency: "RUB",
  images: ["https://cdn.stariva.ru/a.jpg"],
  category: "clothes",
  subcategory: "tops",
  ozonSku: 3723160127,
  inStock: true,
  stockAvailable: 150,
  madeToOrder: true,
  material: "",
  featured: false,
};

let catalog: ProductsResult = { products: [], status: "available" };

mock.module("@/lib/ozon-service", () => ({
  getProductsResult: async () => catalog,
}));

const { POST } = await import("./route");

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/cart/validate", {
    method: "POST",
    body: JSON.stringify(body),
  });

test("returns fresh price and capped stock for buyable products", async () => {
  catalog = { products: [product], status: "available" };

  const res = await POST(request({ slugs: [product.slug, product.slug] }));

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    lines: [
      {
        productSlug: product.slug,
        available: true,
        name: "Туника",
        image: "https://cdn.stariva.ru/a.jpg",
        ozonSku: 3723160127,
        price: 350000,
        maxQuantity: 99,
      },
    ],
  });
});

test("tells sold-out products from missing ones", async () => {
  catalog = {
    products: [{ ...product, inStock: false, stockAvailable: 0 }],
    status: "available",
  };

  const res = await POST(request({ slugs: [product.slug, "gone"] }));

  assert.deepEqual(await res.json(), {
    lines: [
      { productSlug: product.slug, available: false, reason: "sold_out" },
      { productSlug: "gone", available: false, reason: "missing" },
    ],
  });
});

test("reports a catalog outage instead of marking everything missing", async () => {
  catalog = { products: [], status: "unavailable" };

  assert.equal((await POST(request({ slugs: [product.slug] }))).status, 503);
});

test("rejects a malformed body", async () => {
  assert.equal((await POST(request({ slugs: [] }))).status, 400);
  assert.equal((await POST(request({}))).status, 400);
});
