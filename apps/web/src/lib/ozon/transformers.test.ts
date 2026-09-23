import assert from "node:assert/strict";
import { test } from "node:test";
import { ozonProductInfoV3Schema, transformOzonProduct } from "./transformers";

const product = {
  id: 1,
  offer_id: "offer-1",
  name: "Product",
  description: "",
  images: [],
  primary_image: "",
  price: "100",
  old_price: "",
  currency_code: "RUB",
};

test("marketing seller price must be a complete finite non-negative number", () => {
  for (const value of ["0", "12.50", " 1e2 "]) {
    assert.equal(
      ozonProductInfoV3Schema.safeParse({
        ...product,
        marketing_seller_price: value,
      }).success,
      true,
      value,
    );
  }

  for (const value of ["1invalid", "Infinity", "NaN", "-1"]) {
    assert.equal(
      ozonProductInfoV3Schema.safeParse({
        ...product,
        marketing_seller_price: value,
      }).success,
      false,
      value,
    );
  }
});

test("empty-string min_price/marketing_seller_price is treated as absent (Ozon sends '' instead of omitting the field)", () => {
  for (const field of ["min_price", "marketing_seller_price"] as const) {
    for (const value of ["", "  "]) {
      const result = ozonProductInfoV3Schema.safeParse({
        ...product,
        [field]: value,
      });
      assert.equal(result.success, true, `${field}=${JSON.stringify(value)}`);
      if (result.success) {
        assert.equal(result.data[field], undefined);
      }
    }
  }
});

test("min_price is used as the displayed price when present", () => {
  const result = transformOzonProduct({
    ...product,
    price: "67000",
    old_price: "70000",
    marketing_seller_price: "60300",
    min_price: "35000",
  });

  assert.equal(result.price, 35000);
  assert.equal(result.oldPrice, 70000);
});

test("falls back to marketing_seller_price when min_price is absent", () => {
  const result = transformOzonProduct({
    ...product,
    price: "67000",
    old_price: "70000",
    marketing_seller_price: "60300",
  });

  assert.equal(result.price, 60300);
  assert.equal(result.oldPrice, 70000);
});

test("falls back to base price when neither min_price nor marketing_seller_price is present", () => {
  const result = transformOzonProduct({
    ...product,
    price: "67000",
    old_price: "70000",
  });

  assert.equal(result.price, 67000);
  assert.equal(result.oldPrice, 70000);
});

test("product is in stock only when Ozon has unreserved stock", () => {
  const withStocks = (stocks: { present: number; reserved: number }[]) =>
    transformOzonProduct({ ...product, stocks: { stocks } }).inStock;

  assert.equal(withStocks([{ present: 1, reserved: 0 }]), true);
  assert.equal(
    withStocks([
      { present: 0, reserved: 0 },
      { present: 2, reserved: 1 },
    ]),
    true,
  );
  assert.equal(withStocks([{ present: 1, reserved: 1 }]), false);
  assert.equal(withStocks([]), false);
  assert.equal(transformOzonProduct(product).inStock, false);
});
