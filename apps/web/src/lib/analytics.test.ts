import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyticsPath,
  analyticsUrl,
  ignoreParam,
  maskContacts,
} from "./analytics";

test("analyticsPath hides ids that open an order or a video without sign-in", () => {
  assert.equal(analyticsPath("/order/abc123"), "/order/status");
  assert.equal(analyticsPath("/order/abc123/pay"), "/order/status/pay");
  assert.equal(
    analyticsPath("/api/video/hls/tok/index.m3u8"),
    "/api/video/hls/:token/index.m3u8",
  );
  assert.equal(
    analyticsPath("/api/workshops/access/tok"),
    "/api/workshops/access/:token",
  );
  assert.equal(analyticsPath("/catalog/clothes"), "/catalog/clothes");
  assert.equal(analyticsPath("/account/orders/42"), "/account/orders/42");
});

test("analyticsUrl keeps campaign tags and drops tokens, form data and hashes", () => {
  assert.equal(
    analyticsUrl(
      "https://stariva.ru/order/abc?utm_source=vk&phone=79991234567#pay",
    ),
    "https://stariva.ru/order/status?utm_source=vk",
  );
  assert.equal(
    analyticsUrl("https://stariva.ru/reset-password?token=secret"),
    "https://stariva.ru/reset-password",
  );
  assert.equal(analyticsUrl("$direct"), "");
});

test("maskContacts hides emails and phone numbers but keeps prices and dates", () => {
  assert.equal(maskContacts("Пишите на olga@example.ru"), "Пишите на ***");
  assert.equal(maskContacts("+7 (999) 123-45-67"), "***");
  assert.equal(maskContacts("89991234567"), "***");
  assert.equal(
    maskContacts("12 500 ₽ до 2026-12-31"),
    "12 500 ₽ до 2026-12-31",
  );
});

test("ignoreParam switches PostHog ignoring on and off and leaves other URLs alone", () => {
  assert.equal(ignoreParam("?ph_ignore=1"), true);
  assert.equal(ignoreParam("?utm_source=vk&ph_ignore=1"), true);
  assert.equal(ignoreParam("?ph_ignore=0"), false);
  assert.equal(ignoreParam("?ph_ignore=yes"), null);
  assert.equal(ignoreParam(""), null);
});
