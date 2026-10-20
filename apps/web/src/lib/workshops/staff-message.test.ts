import { expect, test } from "bun:test";
import type { orders } from "@stariva/db/schema";
import { formatWorkshopPurchaseMessage } from "./staff-message";

const order = {
  id: "order",
  userId: "user",
  workshopSlug: "elka",
  amount: 249000,
  currency: "RUB",
  status: "paid",
  paymentId: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  paidAt: new Date("2026-10-01T10:05:00Z"),
  contactEmail: "buyer@example.test",
  accessToken: "token",
  telegramToken: null,
  telegramChatId: null,
  attribution: null,
  visitor: null,
} satisfies typeof orders.$inferSelect;

const now = new Date("2026-10-12T12:00:00Z");

test("purchase message names the workshop, price and buyer", () => {
  const { title, message } = formatWorkshopPurchaseMessage(
    order,
    { title: "Ёлка макраме", releaseAt: null },
    "account@example.test",
    now,
  );
  expect(title).toBe("Куплен мастер-класс «Ёлка макраме» · 2 490 ₽");
  expect(message).toBe("Email: buyer@example.test");
});

test("preorder adds the release date, account email fills a missing contact", () => {
  const { message } = formatWorkshopPurchaseMessage(
    { ...order, contactEmail: null },
    { title: "Ёлка макраме", releaseAt: new Date("2026-11-20T15:00:00Z") },
    "account@example.test",
    now,
  );
  expect(message).toStartWith(
    "Email: account@example.test\nПредзаказ: уроки откроются ",
  );
});

test("a Livemaster code is announced as an activation, not a site purchase", () => {
  const touch = {
    utm_source: "livemaster",
    utm_medium: "marketplace",
    landing: "/code",
    at: "2026-10-01T10:00:00Z",
  };
  const { title } = formatWorkshopPurchaseMessage(
    { ...order, attribution: { first: touch, last: touch } },
    { title: "Ёлка макраме", releaseAt: null },
    "account@example.test",
    now,
  );
  expect(title).toBe(
    "Активирован код с Ярмарки Мастеров: «Ёлка макраме» · 2 490 ₽",
  );
});
