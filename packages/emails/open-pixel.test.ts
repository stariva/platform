import { expect, test } from "bun:test";

import {
  newOpenToken,
  openPixelUrl,
  withOpenPixel,
  withoutPersonalToken,
} from "./open-pixel";

test("puts the pixel right before the closing body tag", () => {
  const html = withOpenPixel(
    "<html><body><p>Привет</p></BODY></html>",
    "https://stariva.test/api/m/o/t1",
  );
  expect(html).toBe(
    '<html><body><p>Привет</p><img src="https://stariva.test/api/m/o/t1" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" /></BODY></html>',
  );
});

test("appends the pixel when there is no body tag", () => {
  expect(withOpenPixel("<p>x</p>", "u")).toEndWith(
    '<img src="u" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />',
  );
});

test("points the pixel at the storefront, stariva.ru by default", () => {
  expect(openPixelUrl("t1")).toBe("https://stariva.ru/api/m/o/t1");
  expect(openPixelUrl("t1", "https://shop.test/")).toBe(
    "https://shop.test/api/m/o/t1",
  );
});

test("makes tokens the pixel route accepts", () => {
  const token = newOpenToken();
  expect(token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  expect(newOpenToken()).not.toBe(token);
});

test("derives the token from the idempotency key, so retries match", () => {
  const token = newOpenToken("workshop:o1:booked:email");
  expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  expect(newOpenToken("workshop:o1:booked:email")).toBe(token);
  expect(newOpenToken("workshop:o2:booked:email")).not.toBe(token);
});

test("turns every personal link into a stub the site does not count", () => {
  const token = "abcdefghijklmnop";
  const html = withOpenPixel(
    `<body><a href="https://stariva.ru/api/m/c/${token}?link=channel">x</a><a href="https://stariva.ru/unsubscribe/${token}">y</a></body>`,
    openPixelUrl(token),
  );
  const stub = withoutPersonalToken(html, token);
  expect(stub).not.toContain(token);
  expect(stub).toContain('src="https://stariva.ru/api/m/o/preview"');
  expect(stub).toContain(
    'href="https://stariva.ru/api/m/c/preview?link=channel"',
  );
  expect(stub).toContain('href="https://stariva.ru/unsubscribe/preview"');
});
