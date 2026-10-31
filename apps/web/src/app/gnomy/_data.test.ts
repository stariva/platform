import { expect, test } from "bun:test";
import type { Product } from "@/lib/catalog/types";
import {
  gnomeList,
  gnomesFaq,
  heroCopy,
  pairButtonLabel,
  pairOffer,
  pickGnomes,
} from "./_data";

function product(slug: string, patch: Partial<Product> = {}): Product {
  return {
    id: slug,
    slug,
    name: slug,
    description: "",
    shortDescription: "",
    price: 3700,
    currency: "RUB",
    images: [],
    category: "interior",
    subcategory: "planters",
    ozonSku: 1,
    inStock: true,
    stockAvailable: 1,
    madeToOrder: false,
    material: "Плюшевая пряжа",
    dimensions: "Высота 40–45 см",
    ...patch,
  };
}

const pumpkin = product("interernoe-ukrashenie-gnom-tykva-osenniy-dekor-9563");
const flyAgaric = product("interernoe-ukrashenie-gnom-mukhomor-dekor-0554");
const other = product("abazhur-makrame-1234");

test("gnomes are picked by the Ozon ID tail of the slug, Pumpkin first", () => {
  const picked = pickGnomes([other, flyAgaric, pumpkin]);
  expect(picked).toEqual({ pumpkin, flyAgaric });
  expect(gnomeList(picked)).toEqual([pumpkin, flyAgaric]);
});

test("a missing gnome is skipped instead of breaking the page", () => {
  expect(gnomeList(pickGnomes([other, flyAgaric]))).toEqual([flyAgaric]);
  expect(gnomeList(pickGnomes([other]))).toEqual([]);
});

test("pair offer sums prices and saving comes from old prices", () => {
  const offer = pairOffer([
    { ...pumpkin, price: 3300, oldPrice: 3700 },
    { ...flyAgaric, price: 3300, oldPrice: 3700 },
  ]);
  expect(offer).toMatchObject({
    price: 6600,
    regularPrice: 7400,
    saving: 800,
    isPair: true,
  });
  expect(pairButtonLabel(offer).replace(/\s/g, " ")).toBe(
    "Оба гнома в корзину — 6 600 ₽",
  );
});

test("a sold-out gnome leaves a single-item offer", () => {
  const offer = pairOffer([pumpkin, { ...flyAgaric, inStock: false }]);
  expect(offer.isPair).toBe(false);
  expect(offer.available).toEqual([pumpkin]);
  expect(offer.saving).toBe(0);
  expect(pairButtonLabel(offer)).toContain(pumpkin.name);
});

test("nothing in stock says so and offers nothing to add", () => {
  const offer = pairOffer([{ ...pumpkin, inStock: false }]);
  expect(offer.available).toEqual([]);
  expect(pairButtonLabel(offer)).toBe("Гномов сейчас нет в наличии");
});

test("faq never calls a gnome a toy or addresses children", () => {
  const text = gnomesFaq([pumpkin, flyAgaric])
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ")
    .toLowerCase();
  expect(text).not.toMatch(/игрушк|детям|ребёнк|ребенк/);
});

test("hero promises a pair only while both gnomes are in stock", () => {
  const sold = { ...flyAgaric, inStock: false };
  const pair = heroCopy(pairOffer([pumpkin, flyAgaric]));
  expect(pair.title).toBe("Два вязаных гнома");
  expect(pair.inStock).toBe(true);

  const single = heroCopy(pairOffer([pumpkin, sold]));
  expect(single.title).toBe("Вязаный гном");
  expect(single.lead).toContain(pumpkin.name);
  expect(single.inStock).toBe(true);

  const none = heroCopy(pairOffer([{ ...pumpkin, inStock: false }, sold]));
  expect(none.inStock).toBe(false);
  expect(none.lead).toContain("нет в наличии");
});
