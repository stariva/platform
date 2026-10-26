import { expect, test } from "bun:test";

import { draftFromRequest, formatPhone, slugFromUrl } from "./order-draft";

test("product card request becomes an order draft", () => {
  const draft = draftFromRequest({
    name: "Яна",
    contact: "9994318392",
    productType: "Одежда",
    size: "По меркам",
    color: "Как на фото",
    description: [
      "Изделие: Туника макраме с вырезом халтер и длинной бахромой, бежевая",
      "Ссылка: https://stariva.ru/catalog/clothes/stariva-makrame-tunika-9594",
      "Размер: По меркам",
      "Мерки:",
      "Рост: 170 см",
      "Обхват груди: 110 см",
      "Желаемая длина: 140,5 см",
      "Цвет: Как на фото",
      "Комментарий: Поуже в талии",
      "и без подкладки",
    ].join("\n"),
  });
  expect(draft).toEqual({
    contactName: "Яна",
    contactPhone: "+7 999 431-83-92",
    contactEmail: "",
    productSlug: "stariva-makrame-tunika-9594",
    name: "Туника макраме с вырезом халтер и длинной бахромой, бежевая",
    size: "По меркам",
    color: "Как на фото",
    measurements: [
      { label: "Рост", value: "170" },
      { label: "Обхват груди", value: "110" },
      { label: "Желаемая длина", value: "140,5" },
    ],
    comment: "Поуже в талии\nи без подкладки",
  });
});

test("free-form request keeps its text as the comment", () => {
  const draft = draftFromRequest({
    name: "",
    contact: "anna@example.com",
    productType: "Панно",
    description: "Панно над кроватью 160 см",
    measurements: "ширина 160",
  });
  expect(draft).toMatchObject({
    contactPhone: "",
    contactEmail: "anna@example.com",
    productSlug: "",
    name: "Панно на заказ",
    size: "По согласованию",
    color: "По согласованию",
    measurements: [],
    comment: "Панно над кроватью 160 см\nМерки: ширина 160",
  });
});

test("phones are formatted only for Russian mobiles", () => {
  expect(formatPhone("8 (999) 431-83-92")).toBe("+7 999 431-83-92");
  expect(formatPhone("+79994318392")).toBe("+7 999 431-83-92");
  expect(formatPhone("9994318392")).toBe("+7 999 431-83-92");
  expect(formatPhone("+7 (495) 123-45-67")).toBe("");
  expect(formatPhone("8 (495) 123-45-67")).toBe("");
  expect(formatPhone("+7 (701) 123-45-67")).toBe("");
  expect(formatPhone("8 (701) 123-45-67")).toBe("");
  expect(formatPhone("+7999431839")).toBe("");
  expect(formatPhone("+799943183920")).toBe("");
  expect(formatPhone("@yana")).toBe("");
  expect(formatPhone("12345")).toBe("");
});

test("slug comes from a catalog link only", () => {
  expect(slugFromUrl("https://stariva.ru/catalog/clothes/tunika-1?x=1")).toBe(
    "tunika-1",
  );
  expect(slugFromUrl("https://stariva.ru/catalog/product/tunika-1")).toBe(
    "tunika-1",
  );
  expect(slugFromUrl("https://stariva.ru/about")).toBe("");
});
