import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTRIBUTION_COOKIE,
  addTouch,
  attributionFromRequest,
  formatTouch,
  parseAttribution,
  serializeAttribution,
  touchFromUrl,
  UTM_KEYS,
} from "./campaign-attribution";

const at = new Date("2026-10-10T12:00:00.000Z");

test("UTM control characters are stripped before trimming and truncation", () => {
  const controls = Array.from({ length: 160 }, (_, i) =>
    i < 32 || i >= 127 ? String.fromCharCode(i) : "",
  ).join("");
  const url = new URL("https://stariva.ru/");
  for (const key of UTM_KEYS) {
    url.searchParams.set(
      key,
      `${controls} Директ${controls}${"я".repeat(120)} `,
    );
  }
  const touch = touchFromUrl(url, null, at);
  assert.ok(touch);
  for (const key of UTM_KEYS) {
    assert.equal(touch[key], `Директ${"я".repeat(114)}`);
    url.searchParams.set(key, controls);
  }
  assert.equal(touchFromUrl(url, null, at), null);
});

test("cookie parsing rejects every UTM control character in either touch", () => {
  const touch = { utm_source: "vk", landing: "/", at: at.toISOString() };
  for (let code = 0; code <= 159; code++) {
    if (code >= 32 && code < 127) continue;
    for (const key of UTM_KEYS) {
      for (const position of ["first", "last"] as const) {
        const attribution = addTouch(null, touch);
        attribution[position] = {
          ...touch,
          [key]: `tag${String.fromCharCode(code)}`,
        };
        assert.equal(parseAttribution(JSON.stringify(attribution)), null);
      }
    }
  }
});

test("serialization preserves small cookies and does not mutate large touches", () => {
  const touch = { utm_source: "vk", landing: "/", at: at.toISOString() };
  const small = addTouch(null, touch);
  assert.equal(serializeAttribution(small), JSON.stringify(small));
  const large = addTouch(null, {
    ...touch,
    ...Object.fromEntries(UTM_KEYS.map((key) => [key, "😀".repeat(60)])),
  });
  const before = structuredClone(large);
  const value = serializeAttribution(large);
  assert.ok(value);
  assert.ok(parseAttribution(value));
  assert.deepEqual(large, before);
  assert.ok(
    Buffer.byteLength(`${ATTRIBUTION_COOKIE}=${encodeURIComponent(value)}`) <=
      4096,
  );
});

test("touch keeps only bounded UTM tags, landing path and referrer host", () => {
  assert.deepEqual(
    touchFromUrl(
      new URL(
        "https://stariva.ru/catalog?utm_source=yandex&utm_campaign=elka&yclid=123&email=private#order",
      ),
      "https://ya.ru/search?text=ёлка",
      at,
    ),
    {
      utm_source: "yandex",
      utm_campaign: "elka",
      landing: "/catalog",
      referrer: "ya.ru",
      at: at.toISOString(),
    },
  );
  const long = touchFromUrl(
    new URL(`https://stariva.ru/?utm_content=${"a".repeat(1000)}`),
    null,
    at,
  );
  assert.equal(long?.utm_content?.length, 120);
  assert.equal(long?.referrer, undefined);
});

test("no UTM — no touch; own referrer and order ids are not stored", () => {
  assert.equal(
    touchFromUrl(new URL("https://stariva.ru/?yclid=1"), null),
    null,
  );
  assert.deepEqual(
    touchFromUrl(
      new URL("https://stariva.ru/order/secret-id?utm_source=email"),
      "https://stariva.ru/cart",
      at,
    ),
    { utm_source: "email", landing: "/order/status", at: at.toISOString() },
  );
});

test("first touch survives, last touch is replaced", () => {
  const first = { utm_source: "vk", landing: "/", at: at.toISOString() };
  const last = {
    utm_source: "yandex",
    landing: "/elka-makrame",
    at: at.toISOString(),
  };
  assert.deepEqual(addTouch(null, first), { first, last: first });
  assert.deepEqual(addTouch(addTouch(null, first), last), { first, last });
});

test("cookie round-trip; anything off-schema is dropped", () => {
  const touch = { utm_source: "Директ", landing: "/", at: at.toISOString() };
  const value = JSON.stringify(addTouch(null, touch));
  const request = new Request("https://stariva.ru/api/checkout/create", {
    headers: {
      cookie: `other=1; ${ATTRIBUTION_COOKIE}=${encodeURIComponent(value)}`,
    },
  });
  assert.deepEqual(attributionFromRequest(request), {
    first: touch,
    last: touch,
  });
  assert.equal(
    attributionFromRequest(new Request("https://stariva.ru/")),
    null,
  );
  assert.equal(parseAttribution("not-json"), null);
  assert.equal(parseAttribution(JSON.stringify({ first: touch })), null);
  assert.equal(
    parseAttribution(
      JSON.stringify({
        first: touch,
        last: { ...touch, utm_term: "x".repeat(500) },
      }),
    ),
    null,
  );
});

test("touch is readable in a notification", () => {
  assert.equal(
    formatTouch({
      utm_source: "yandex",
      utm_campaign: "elka",
      landing: "/elka-makrame",
      referrer: "ya.ru",
      at: at.toISOString(),
    }),
    "utm_source=yandex, utm_campaign=elka → /elka-makrame (с ya.ru)",
  );
});
