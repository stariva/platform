import { expect, test } from "bun:test";
import type { CartItem } from "./cart-context";
import { cartChanges, toEventItem } from "./events";

const stock = (productSlug: string, quantity: number): CartItem => ({
  productSlug,
  ozonSku: 1,
  name: `Изделие ${productSlug}`,
  image: "https://cdn.stariva.ru/a.jpg",
  price: 350000,
  quantity,
  fulfillmentType: "stock",
});

const madeToOrder = (size: string, quantity: number): CartItem => ({
  productSlug: "elka",
  name: "Ёлка макраме",
  image: "",
  price: 500000,
  quantity,
  fulfillmentType: "made_to_order",
  options: { size, color: "бежевый", measurements: [], comment: "к НГ" },
});

test("новая строка — изменение с 0", () => {
  expect(cartChanges([], [stock("a", 1)])).toEqual([
    {
      productSlug: "a",
      fulfillmentType: "stock",
      name: "Изделие a",
      price: 350000,
      before: 0,
      after: 1,
    },
  ]);
});

test("убранная строка — изменение до 0, нетронутые не попадают", () => {
  const changes = cartChanges([stock("a", 1), stock("b", 2)], [stock("a", 1)]);
  expect(changes.map((c) => [c.productSlug, c.before, c.after])).toEqual([
    ["b", 2, 0],
  ]);
});

test("смена количества и цены: цена изменением не считается", () => {
  const changes = cartChanges(
    [stock("a", 1), stock("b", 1)],
    [stock("a", 3), { ...stock("b", 1), price: 1 }],
  );
  expect(changes.map((c) => [c.productSlug, c.before, c.after])).toEqual([
    ["a", 1, 3],
  ]);
});

test("варианты под заказ — разные строки", () => {
  const changes = cartChanges([madeToOrder("S", 1)], [madeToOrder("M", 1)]);
  expect(changes.map((c) => [c.options?.size, c.before, c.after])).toEqual([
    ["M", 0, 1],
    ["S", 1, 0],
  ]);
});

test("в журнал не уходят мерки, комментарий и пустая картинка", () => {
  expect(toEventItem(madeToOrder("M", 2))).toEqual({
    productSlug: "elka",
    fulfillmentType: "made_to_order",
    name: "Ёлка макраме",
    price: 500000,
    quantity: 2,
    options: { size: "M", color: "бежевый" },
  });
});
