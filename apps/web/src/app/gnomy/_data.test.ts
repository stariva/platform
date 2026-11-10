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

test("pair costs the bundle price while each gnome keeps its own price", () => {
  const offer = pairOffer([pumpkin, flyAgaric]);
  expect(offer).toMatchObject({
    price: 6300,
    regularPrice: 7400,
    saving: 1100,
    isPair: true,
  });
  expect(pairButtonLabel(offer).replace(/\s/g, " ")).toBe(
    "Оба гнома в корзину — 6 300 ₽",
  );
});

test("the bundle price never exceeds the sum of single prices", () => {
  const offer = pairOffer([
    { ...pumpkin, price: 3000 },
    { ...flyAgaric, price: 3000 },
  ]);
  expect(offer).toMatchObject({ price: 6000, saving: 0 });
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

test("the landing speaks of New Year, not of autumn", () => {
  const text = [
    heroCopy(pairOffer([pumpkin, flyAgaric])).lead,
    ...gnomesFaq([pumpkin, flyAgaric]).map((i) => `${i.question} ${i.answer}`),
  ]
    .join(" ")
    .toLowerCase();
  expect(text).toContain("нов");
  expect(text).not.toMatch(/осен/);
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

test("size answer names each gnome instead of gluing catalog strings", () => {
  const [size] = gnomesFaq([
    pumpkin,
    { ...flyAgaric, dimensions: "Высота около 40 см" },
  ]);
  expect(size?.answer).toStartWith("Тыква — 40–45 см, Мухомор — около 40 см.");
  expect(size?.answer).not.toContain("Высота");

  const [same] = gnomesFaq([pumpkin, flyAgaric]);
  expect(same?.answer).toStartWith("Оба гнома — 40–45 см.");
});

test("scarcity line shows only while something is in stock", () => {
  const sold = { ...flyAgaric, inStock: false };
  expect(heroCopy(pairOffer([pumpkin, flyAgaric])).scarcity).toContain(
    "Гномы в наличии",
  );
  expect(
    heroCopy(pairOffer([{ ...pumpkin, inStock: false }, sold])).scarcity,
  ).toBeNull();
});

test("hero avoids quantity claims for different stock counts", () => {
  for (const stockAvailable of [0, 1, 2, 5]) {
    for (const gnomes of [
      [{ ...pumpkin, stockAvailable }],
      [pumpkin, { ...flyAgaric, stockAvailable }],
      [{ ...pumpkin, inStock: false }],
    ]) {
      const { badge, scarcity } = heroCopy(pairOffer(gnomes));
      expect(`${badge} ${scarcity ?? ""}`).not.toMatch(
        /единственн|одна пара|Остался один/,
      );
    }
  }
});

test("ambiguous dimensions are not presented as height", () => {
  for (const dimensions of [
    "Высота 40 см, ширина 20 см",
    "Высота 40 см × 20 см",
    "40 × 20 см",
    "Ширина 40 см",
    "40 см",
    "",
    undefined,
  ]) {
    const gnome = { ...pumpkin, dimensions };
    const [size] = gnomesFaq([gnome]);
    expect(size?.answer).toStartWith("Размеры указаны в карточках гномов.");
    expect(size?.answer).not.toContain("рост");
    expect(gnome.dimensions).toBe(dimensions);

    const [mixed] = gnomesFaq([gnome, flyAgaric]);
    expect(mixed?.answer).toStartWith("Мухомор — 40–45 см.");
  }
});

test("different height descriptions do not imply a height difference", () => {
  const [size] = gnomesFaq([
    { ...pumpkin, dimensions: "Высота 40 см" },
    { ...flyAgaric, dimensions: "Высота около 40 см" },
  ]);
  expect(size?.answer).toStartWith("Тыква — 40 см, Мухомор — около 40 см.");
  expect(size?.answer).not.toContain("разница");
});
