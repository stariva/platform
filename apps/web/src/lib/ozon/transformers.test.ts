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

  for (const value of ["", "  ", "1invalid", "Infinity", "NaN", "-1"]) {
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
