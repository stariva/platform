import { expect, test } from "bun:test";

import { insideRussia, type PurchaseRow, placeOf, placesOf } from "./model";

const row = (fields: Partial<PurchaseRow> = {}): PurchaseRow => ({
  amountTotal: 250_000,
  userId: null,
  contactPhone: "+7 916 123-45-67",
  deliveryAddress: null,
  visitor: null,
  ...fields,
});

const spb = {
  lat: 59.755,
  lng: 30.329,
  locality: "Санкт-Петербург",
  address: "Россия, Санкт-Петербург, Шушары, улица Нины Петровой, 8 к2",
};
const moscowVisitor = {
  city: "Москва",
  countryCode: "RU",
  latitude: 55.754,
  longitude: 37.62,
};

test("город пункта выдачи важнее города по IP", () => {
  expect(
    placeOf(row({ deliveryAddress: spb, visitor: moscowVisitor })),
  ).toEqual({
    city: "Санкт-Петербург",
    lat: 59.755,
    lng: 30.329,
    source: "delivery",
  });
});

test("без доставки берём город по IP", () => {
  expect(placeOf(row({ visitor: moscowVisitor }))?.source).toBe("ip");
  expect(placeOf(row({ visitor: moscowVisitor }))?.city).toBe("Москва");
});

test("старый заказ без locality берёт область из адреса пункта", () => {
  const place = placeOf(
    row({
      deliveryAddress: {
        lat: 59.668,
        lng: 30.524,
        address: "Россия, Ленинградская Область, Тосненский Район, Фёдоровское",
      },
    }),
  );
  expect(place?.city).toBe("Ленинградская Область");
  expect(place?.source).toBe("delivery");
});

test("без координат места нет", () => {
  expect(placeOf(row())).toBeNull();
  expect(
    placeOf(row({ visitor: { city: "Москва", countryCode: "RU" } })),
  ).toBeNull();
});

test("заказы одного города сливаются в точку со своими итогами", () => {
  const { places, unplaced } = placesOf([
    row({ deliveryAddress: spb, userId: "a" }),
    row({
      deliveryAddress: { ...spb, lat: 59.9, lng: 30.3 },
      userId: "a",
      amountTotal: 100_000,
    }),
    row({ deliveryAddress: spb, userId: "b" }),
    row({ visitor: moscowVisitor }),
    row(),
  ]);
  expect(unplaced).toBe(1);
  expect(places.map((place) => place.city)).toEqual([
    "Санкт-Петербург",
    "Москва",
  ]);
  expect(places[0]).toMatchObject({
    orders: 3,
    customers: 2,
    revenue: 6000,
    byIp: 0,
    inRussia: true,
  });
  expect(places[1]).toMatchObject({ orders: 1, byIp: 1, source: "ip" });
});

test("покупатель без аккаунта считается по телефону", () => {
  const { places } = placesOf([
    row({ deliveryAddress: spb, contactPhone: "+7 (916) 123-45-67" }),
    row({ deliveryAddress: spb, contactPhone: "89161234567" }),
    row({ deliveryAddress: spb, contactPhone: "+7 916 123-45-67" }),
  ]);
  // Два написания одного номера дают одного покупателя, «8…» — другого
  expect(places[0]?.customers).toBe(2);
});

test("ё и е в названии города — один город", () => {
  const { places } = placesOf([
    row({ deliveryAddress: { ...spb, locality: "Орёл" } }),
    row({ deliveryAddress: { ...spb, locality: "Орел" } }),
  ]);
  expect(places).toHaveLength(1);
  expect(places[0]?.orders).toBe(2);
});

test("Чукотка по обе стороны 180° остаётся в России", () => {
  expect(insideRussia(64.7, 177.5)).toBe(true);
  expect(insideRussia(66.2, -170)).toBe(true);
  expect(insideRussia(52.5, 13.4)).toBe(false);
  expect(insideRussia(40.4, 49.9)).toBe(false);
});

test("точка в Германии не попадает на карту России", () => {
  const { places } = placesOf([
    row({
      visitor: {
        city: "Берлин",
        countryCode: "DE",
        latitude: 52.5,
        longitude: 13.4,
      },
    }),
  ]);
  expect(places[0]?.inRussia).toBe(false);
});
