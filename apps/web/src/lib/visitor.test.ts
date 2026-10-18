import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ATTRIBUTION_COOKIE } from "./campaign-attribution";
import {
  clientIp,
  collectVisitor,
  envFromCookie,
  formatVisitor,
  geoFromHeaders,
  isPublicIp,
  lookupGeo,
  parseUserAgent,
  resetGeoState,
  VISITOR_ENV_COOKIE,
} from "./visitor";

const chromeWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const safariIphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const androidYandex =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.6.0 Mobile Safari/537.36";

beforeEach(resetGeoState);

test("client IP prefers proxy headers and rejects garbage", () => {
  assert.equal(
    clientIp(
      new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }),
    ),
    "203.0.113.7",
  );
  assert.equal(
    clientIp(new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" })),
    "198.51.100.4",
  );
  assert.equal(
    clientIp(new Headers({ "x-forwarded-for": "::ffff:198.51.100.9" })),
    "198.51.100.9",
  );
  // Cloudflare перед сайтом нет: этот заголовок подделывает сам клиент
  assert.equal(
    clientIp(
      new Headers({
        "cf-connecting-ip": "1.2.3.4",
        "x-real-ip": "203.0.113.7",
      }),
    ),
    "203.0.113.7",
  );
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "not-an-ip" })), null);
  assert.equal(clientIp(new Headers()), null);
});

test("private and loopback addresses are not looked up", () => {
  for (const ip of [
    "10.1.2.3",
    "127.0.0.1",
    "192.168.0.5",
    "172.20.1.1",
    "::1",
  ])
    assert.equal(isPublicIp(ip), false, ip);
  for (const ip of ["8.8.8.8", "203.0.113.7", "2a00:1450:4001::1"])
    assert.equal(isPublicIp(ip), true, ip);
});

test("user agent is parsed into browser, OS and device", () => {
  assert.deepEqual(parseUserAgent(chromeWindows), {
    browser: "Chrome 126",
    os: "Windows 10/11",
    device: "desktop",
    deviceModel: undefined,
  });
  assert.deepEqual(parseUserAgent(safariIphone), {
    browser: "Safari 17",
    os: "iOS 17.5",
    device: "mobile",
    deviceModel: "iPhone",
  });
  assert.deepEqual(parseUserAgent(androidYandex), {
    browser: "Yandex Browser 24",
    os: "Android 14",
    device: "mobile",
    deviceModel: "SM-S918B",
  });
  assert.equal(parseUserAgent("Googlebot/2.1").device, "bot");
});

test("CDN geo headers are decoded", () => {
  const geo = geoFromHeaders(
    new Headers({
      "x-vercel-ip-country": "RU",
      "x-vercel-ip-city": "%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0",
      "x-vercel-ip-latitude": "55.75",
      "x-vercel-ip-longitude": "37.61",
    }),
  );
  assert.equal(geo?.city, "Москва");
  assert.equal(geo?.countryCode, "RU");
  assert.equal(geo?.latitude, 55.75);
  assert.equal(geoFromHeaders(new Headers({ "cf-ipcountry": "XX" })), null);
  assert.equal(geoFromHeaders(new Headers()), null);
});

test("env cookie is read and bad cookies are dropped", () => {
  const value = encodeURIComponent(
    JSON.stringify({ tz: "Europe/Moscow", scr: "1920x1080", dpr: 2 }),
  );
  assert.deepEqual(envFromCookie(`a=1; ${VISITOR_ENV_COOKIE}=${value}; b=2`), {
    tz: "Europe/Moscow",
    scr: "1920x1080",
    dpr: 2,
  });
  assert.equal(envFromCookie(`${VISITOR_ENV_COOKIE}=%7Bbroken`), null);
  assert.equal(
    envFromCookie(`${VISITOR_ENV_COOKIE}=${encodeURIComponent('{"dpr":"x"}')}`),
    null,
  );
  assert.equal(envFromCookie(null), null);
});

test("geo lookup is cached and backs off after a failure", async () => {
  let calls = 0;
  const ok = (async () => {
    calls++;
    return Response.json({
      location: {
        data: {
          country: "Россия",
          country_iso_code: "RU",
          region_with_type: "г Москва",
          city: "Москва",
          geo_lat: "55.75",
          geo_lon: "37.61",
        },
      },
    });
  }) as unknown as typeof fetch;
  const first = await lookupGeo("203.0.113.7", "key", ok);
  assert.equal(first?.city, "Москва");
  assert.equal(first?.latitude, 55.75);
  await lookupGeo("203.0.113.7", "key", ok);
  assert.equal(calls, 1);

  const failing = (async () => {
    calls++;
    throw new Error("down");
  }) as unknown as typeof fetch;
  const now = Date.now();
  assert.equal(await lookupGeo("203.0.113.8", "key", failing, now), null);
  assert.equal(
    await lookupGeo("203.0.113.9", "key", failing, now + 1000),
    null,
  );
  assert.equal(calls, 2);
});

test("geo lookup skips foreign IPs and missing keys without calling the service down", async () => {
  const empty = (async () =>
    Response.json({ location: null })) as unknown as typeof fetch;
  assert.equal(await lookupGeo("198.51.100.1", "key", empty), null);
  // Чужой IP — не сбой: следующий запрос не блокируется паузой.
  assert.equal(await lookupGeo("198.51.100.2", undefined, empty), null);
  const found = (async () =>
    Response.json({
      location: { data: { city: "Тверь" } },
    })) as unknown as typeof fetch;
  assert.equal((await lookupGeo("198.51.100.3", "key", found))?.city, "Тверь");
});

test("empty geo results are cached per IP and retried after five minutes", async () => {
  for (const location of [null, { data: {} }]) {
    resetGeoState();
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      return Response.json(
        calls <= 2 ? { location } : { location: { data: { city: "Тверь" } } },
      );
    }) as unknown as typeof fetch;
    const now = 1_000_000;
    assert.equal(await lookupGeo("198.51.100.1", "key", fetcher, now), null);
    assert.equal(
      await lookupGeo("198.51.100.1", "key", fetcher, now + 299_999),
      null,
    );
    assert.equal(calls, 1);
    assert.equal(await lookupGeo("198.51.100.2", "key", fetcher, now), null);
    assert.equal(calls, 2);
    assert.equal(
      (await lookupGeo("198.51.100.1", "key", fetcher, now + 300_000))?.city,
      "Тверь",
    );
    assert.equal(calls, 3);
  }
});

test("empty geo results respect the cache size limit", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return Response.json({ location: null });
  }) as unknown as typeof fetch;
  for (let i = 0; i <= 500; i++) {
    await lookupGeo(
      `198.51.${Math.floor(i / 256)}.${i % 256}`,
      "key",
      fetcher,
      0,
    );
  }
  await lookupGeo("198.51.1.244", "key", fetcher, 1);
  assert.equal(calls, 501);
  await lookupGeo("198.51.0.0", "key", fetcher, 1);
  assert.equal(calls, 502);
});

test("visitor combines headers, geo lookup and the env cookie", async () => {
  const cookie = encodeURIComponent(
    JSON.stringify({ tz: "Europe/Moscow", scr: "390x844", lang: "ru-RU" }),
  );
  const request = new Request("http://localhost/api/checkout/create", {
    method: "POST",
    headers: {
      "x-real-ip": "203.0.113.7",
      "user-agent": safariIphone,
      "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      referer: "https://stariva.ru/catalog/lamps?utm_source=x#top",
      cookie: `${VISITOR_ENV_COOKIE}=${cookie}`,
    },
  });
  const visitor = await collectVisitor(request, {
    lookup: async () => ({ city: "Москва", countryCode: "RU" }),
  });
  assert.equal(visitor.ip, "203.0.113.7");
  assert.equal(visitor.city, "Москва");
  assert.equal(visitor.geoSource, "lookup");
  assert.equal(visitor.device, "mobile");
  assert.equal(visitor.timezone, "Europe/Moscow");
  assert.equal(visitor.screen, "390x844");
  assert.equal(visitor.language, "ru-RU");
  assert.equal(visitor.page, "/catalog/lamps");
  assert.equal(visitor.referrer, undefined);
  assert.ok(formatVisitor(visitor).includes("IP: 203.0.113.7"));
});

test("visitor uses the saved arrival referrer while keeping the submission page", async () => {
  const first = {
    landing: "/catalog",
    referrer: "vk.com",
    at: "2026-10-10T12:00:00.000Z",
  };
  const last = { ...first, referrer: "ya.ru" };
  for (const [cookie, expected] of [
    [JSON.stringify({ first, last }), "ya.ru"],
    [
      JSON.stringify({ first, last: { ...last, referrer: undefined } }),
      undefined,
    ],
    ["broken", undefined],
  ] as const) {
    const visitor = await collectVisitor(
      new Request("https://stariva.ru/api/checkout/create", {
        headers: {
          referer: "https://stariva.ru/order/private-id?secret=value#form",
          cookie: `${ATTRIBUTION_COOKIE}=${encodeURIComponent(cookie)}`,
        },
      }),
    );
    assert.equal(visitor.referrer, expected);
    assert.equal(visitor.page, "/order/status");
  }
});

test("a failing lookup never breaks the order", async () => {
  const visitor = await collectVisitor(
    new Request("http://localhost/", { headers: { "x-real-ip": "8.8.8.8" } }),
    {
      lookup: async () => {
        throw new Error("boom");
      },
    },
  );
  assert.equal(visitor.ip, "8.8.8.8");
  assert.equal(visitor.city, undefined);
  assert.ok(visitor.at);
});
