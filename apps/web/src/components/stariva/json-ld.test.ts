import { expect, test } from "bun:test";
import { googleProductCategory, toJsonLd } from "./json-ld";

test("product category comes from Google's taxonomy, not our section names", () => {
  expect(googleProductCategory("clothes", "dresses")).toBe(
    "Apparel & Accessories > Clothing",
  );
  expect(googleProductCategory("interior", "lampshades")).toBe(
    "Home & Garden > Lighting Accessories > Lamp Shades",
  );
  expect(googleProductCategory("unknown", "unknown")).toBe(
    "Home & Garden > Decor",
  );
});

test("a review cannot close the JSON-LD script tag", () => {
  const json = toJsonLd({
    reviewBody: "Отлично!</script><script>alert(1)</script>",
  });
  expect(json).not.toContain("</script");
  expect(json).not.toContain("<");
  // Для поисковика это тот же текст
  expect(JSON.parse(json).reviewBody).toBe(
    "Отлично!</script><script>alert(1)</script>",
  );
});
