import assert from "node:assert/strict";
import { test } from "node:test";
import { ozonProductInfoV3Schema } from "./transformers";

const product = {
  id: 1,
  offer_id: "offer-1",
  name: "Product",
  images: [],
  primary_image: "",
  price: "100",
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
