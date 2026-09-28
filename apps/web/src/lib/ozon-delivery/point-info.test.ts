import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDateRange,
  formatDistance,
  holidayNotice,
  todayHours,
  weekSchedule,
} from "./format";
import { localDateOf, normalizePointInfo, pointInfoSchema } from "./point-info";

const ozonPoint = pointInfoSchema.parse({
  enabled: true,
  delivery_method: {
    map_point_id: 1011000000123456,
    address: "Россия, Москва, Тверская улица, 7",
    address_details: {
      city: "Москва",
      region: "Москва",
      street: "Тверская улица",
      house: "7",
    },
    coordinates: { lat: 55.757, long: 37.612 },
    delivery_type: { id: 1, name: "ПВЗ" },
    description: "Вход со двора, вывеска Ozon",
    holidays: [],
    images: ["https://cdn1.ozone.ru/s3/pvz/1.jpg"],
    pvz_rating: 4.87,
    storage_period: 7,
    working_hours: [
      // Полночь по Москве — 21:00Z предыдущих суток
      {
        date: "2026-09-27T21:00:00Z",
        periods: [
          { min: { hours: 10, minutes: 0 }, max: { hours: 21, minutes: 0 } },
        ],
      },
      {
        date: "2026-09-28T21:00:00Z",
        periods: [
          { min: { hours: 10, minutes: 0 }, max: { hours: 21, minutes: 0 } },
        ],
      },
      { date: "2026-09-29T21:00:00Z", periods: [] },
    ],
  },
});

test("local midnight of eastern timezones maps to the right day", () => {
  assert.equal(localDateOf("2026-09-27T21:00:00Z"), "2026-09-28"); // Москва
  assert.equal(localDateOf("2026-09-27T14:00:00Z"), "2026-09-28"); // Владивосток
  assert.equal(localDateOf("2026-09-28T00:00:00Z"), "2026-09-28");
  assert.equal(localDateOf("nonsense"), null);
});

test("point info becomes a readable street address", () => {
  const point = normalizePointInfo(ozonPoint);
  assert.ok(point);
  assert.equal(point.id, "1011000000123456");
  assert.equal(point.title, "Тверская улица, 7");
  assert.equal(point.locality, "Москва");
  assert.equal(point.kind, "pvz");
  assert.equal(point.rating, 4.87);
  assert.equal(point.storageDays, 7);
  assert.deepEqual(
    point.schedule.map((d) => d.date),
    ["2026-09-28", "2026-09-29", "2026-09-30"],
  );
});

test("title falls back to the full address without country, region and zip", () => {
  const point = normalizePointInfo(
    pointInfoSchema.parse({
      delivery_method: {
        map_point_id: 5,
        address: "Россия, 420111, Казань, ул. Баумана, 1",
        address_details: { city: "Казань" },
        coordinates: { lat: 55.79, long: 49.11 },
        delivery_type: { name: "Постамат" },
      },
    }),
  );
  assert.equal(point?.title, "ул. Баумана, 1");
  assert.equal(point?.kind, "postamat");
});

test("points without address or coordinates are dropped", () => {
  assert.equal(
    normalizePointInfo(
      pointInfoSchema.parse({ delivery_method: { map_point_id: 1 } }),
    ),
    null,
  );
});

test("hours are described for today and grouped for the week", () => {
  const point = normalizePointInfo(ozonPoint);
  assert.ok(point);
  const now = new Date(2026, 8, 28, 12);
  assert.equal(todayHours(point, now), "Сегодня 10:00–21:00");
  assert.deepEqual(weekSchedule(point, now), [
    { days: "Пн–Вт", hours: "10:00–21:00" },
    { days: "Ср", hours: "выходной" },
  ]);
});

test("round-the-clock points and holidays", () => {
  const point = normalizePointInfo(ozonPoint);
  assert.ok(point);
  const now = new Date(2026, 8, 28, 12);
  const allDay = {
    ...point,
    schedule: [
      { date: "2026-09-28", periods: [{ open: "00:00", close: "23:59" }] },
    ],
  };
  assert.equal(todayHours(allDay, now), "Круглосуточно");
  assert.equal(
    holidayNotice(
      { ...point, holidays: [{ from: "2026-10-03", to: "2026-10-05" }] },
      now,
    ),
    "Не работает 3–5 октября",
  );
  assert.equal(
    holidayNotice(
      { ...point, holidays: [{ from: "2026-09-20", to: "2026-09-30" }] },
      now,
    ),
    "Временно не работает до 30 сентября включительно",
  );
  assert.equal(
    holidayNotice(
      { ...point, holidays: [{ from: "2026-12-30", to: "2027-01-02" }] },
      now,
    ),
    undefined,
  );
});

test("week schedule reads from Monday regardless of today", () => {
  const point = normalizePointInfo(ozonPoint);
  assert.ok(point);
  const week = (date: string, close: string) => ({
    date,
    periods: [{ open: "10:00", close }],
  });
  // Воскресенье 27.09 — первый день в данных, но в расписании он последний
  const schedule = [
    week("2026-09-27", "18:00"),
    week("2026-09-28", "21:00"),
    week("2026-09-29", "21:00"),
    week("2026-09-30", "21:00"),
    week("2026-10-01", "21:00"),
    week("2026-10-02", "21:00"),
    week("2026-10-03", "18:00"),
  ];
  assert.deepEqual(
    weekSchedule({ ...point, schedule }, new Date(2026, 8, 27, 9)),
    [
      { days: "Пн–Пт", hours: "10:00–21:00" },
      { days: "Сб–Вс", hours: "10:00–18:00" },
    ],
  );
});

test("date ranges collapse within one month", () => {
  assert.equal(formatDateRange("2026-10-01", "2026-10-02"), "1–2 октября");
  assert.equal(
    formatDateRange("2026-09-30", "2026-10-02"),
    "30 сентября – 2 октября",
  );
  assert.equal(formatDateRange("2026-10-05", "2026-10-05"), "5 октября");
});

test("distance is short and human", () => {
  assert.equal(formatDistance(0.004), "10 м");
  assert.equal(formatDistance(0.347), "350 м");
  assert.equal(formatDistance(1.26), "1,3 км");
  assert.equal(formatDistance(23.4), "23 км");
});
