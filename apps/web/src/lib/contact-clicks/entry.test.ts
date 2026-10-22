import assert from "node:assert/strict";
import { test } from "node:test";
import { contactChannelOf, whatsappUrl } from "@/lib/contacts";
import { entryFromLocation } from "./entry";

const at = new Date("2026-10-22T09:00:00.000Z");

test("заход с объявления: метки, yclid и сайт, с которого пришли", () => {
  const { entry, fresh } = entryFromLocation(
    new URL(
      "https://stariva.ru/elka-makrame-bolshaya?utm_source=yandex&utm_campaign=elka_big&yclid=123&email=a@b.ru",
    ),
    "https://yandex.ru/search/?text=ёлка",
    at,
  );
  assert.equal(fresh, true);
  assert.deepEqual(entry, {
    landing: "/elka-makrame-bolshaya",
    referrer: "yandex.ru",
    utm_source: "yandex",
    utm_campaign: "elka_big",
    yclid: "123",
    at: at.toISOString(),
  });
});

test("заход из поиска без меток — тоже новый заход", () => {
  const { entry, fresh } = entryFromLocation(
    new URL("https://stariva.ru/abazhury"),
    "https://www.google.com/",
    at,
  );
  assert.equal(fresh, true);
  assert.equal(entry.referrer, "www.google.com");
});

test("переход по сайту и прямой заход не перетирают запомненный", () => {
  assert.equal(
    entryFromLocation(
      new URL("https://stariva.ru/catalog"),
      "https://stariva.ru/",
      at,
    ).fresh,
    false,
  );
  assert.equal(
    entryFromLocation(new URL("https://stariva.ru/"), "", at).fresh,
    false,
  );
});

test("id заказа в пути не попадает в страницу входа", () => {
  const { entry } = entryFromLocation(
    new URL("https://stariva.ru/order/secret-token?utm_source=email"),
    "",
    at,
  );
  assert.equal(entry.landing, "/order/status");
});

test("каналы связи узнаются по ссылке, бот напоминаний — нет", () => {
  assert.equal(contactChannelOf("https://t.me/Olga_Stariva"), "telegram");
  assert.equal(contactChannelOf("https://t.me/olga_stariva/"), "telegram");
  assert.equal(contactChannelOf(whatsappUrl("Здравствуйте")), "whatsapp");
  assert.equal(contactChannelOf("tel:+79778722546"), "phone");
  assert.equal(contactChannelOf("https://t.me/StarivaBot?start=abc"), null);
  assert.equal(contactChannelOf("https://vk.com/stariva_macrame"), null);
});
