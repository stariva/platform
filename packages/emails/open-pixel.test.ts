import { expect, test } from "bun:test";

import { newOpenToken, openPixelUrl, withOpenPixel } from "./open-pixel";

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
