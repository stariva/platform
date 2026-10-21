import { expect, test } from "bun:test";
import { cartEventSchema } from "./event-log";

const line = {
  productSlug: "tunika-5565",
  fulfillmentType: "stock",
  name: "Туника",
  price: 350000,
  quantity: 1,
};

function parseImage(image: unknown) {
  return cartEventSchema.parse({
    cartId: "cart-image-test",
    action: "add",
    changes: [],
    items: [{ ...line, image }],
  }).items[0]?.image;
}

test.each([
  "/images/tunika.jpg",
  "https://cdn.stariva.ru/products/a.jpg",
  "https://cdn1.ozon.ru/a.jpg",
  "https://cdn2.ozon.ru/a.jpg",
  "https://cdn3.ozon.ru/a.jpg",
  "https://cdn1.ozone.ru/a.jpg",
  "https://cdn2.ozone.ru/a.jpg",
  "https://cdn3.ozone.ru/a.jpg",
  "https://ir.ozone.ru/a.jpg",
  "https://s3.ozone.ru/a.jpg",
  "https://storage.yandexcloud.net/stariva-public/a.jpg",
  "https://stariva-public.storage.yandexcloud.net/a.jpg",
])("сохраняет разрешённое изображение %s", (image) => {
  expect(parseImage(image)).toBe(image);
});

test.each([
  "https://evil.example/a.jpg",
  "http://cdn.stariva.ru/a.jpg",
  "http://stariva-public.storage.yandexcloud.net/a.jpg",
  "https://cdn.stariva.ru.evil.example/a.jpg",
  "https://storage.yandexcloud.net.evil.example/a.jpg",
  "https://evil-storage.yandexcloud.net/a.jpg",
  "https://cdn.stariva.ru@evil.example/a.jpg",
  "https://evil.example@cdn.stariva.ru/a.jpg",
  "https://cdn.stariva.ru:8443/a.jpg",
  "//evil.example/a.jpg",
  "/\\evil.example/a.jpg",
  "/\n/evil.example/a.jpg",
  "/\t/evil.example/a.jpg",
  "javascript:alert(1)",
  "data:image/svg+xml,<svg/>",
  "images/a.jpg",
  "not a url",
  "",
  `/${"a".repeat(1000)}`,
  123,
  null,
  undefined,
])("отбрасывает недопустимое изображение %p, сохраняя событие", (image) => {
  expect(parseImage(image)).toBeUndefined();
});
