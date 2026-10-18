import { afterEach, expect, spyOn, test } from "bun:test";
import { logger } from "@stariva/config";
import { POST } from "./route";

const warn = spyOn(logger, "warn").mockImplementation(() => {});
afterEach(() => warn.mockClear());

const post = (body: string, contentType: string, headers?: HeadersInit) =>
  POST(
    new Request("https://stariva.ru/api/csp-report", {
      method: "POST",
      body,
      headers: { "content-type": contentType, ...headers },
    }),
  );

const violations = () =>
  warn.mock.calls.filter(([message]) => message === "csp.violation");

test("a report-uri report is logged without query strings and secret paths", async () => {
  const response = await post(
    JSON.stringify({
      "csp-report": {
        "document-uri":
          "https://stariva.ru/order/8f1c2d0e-secret?token=abc#pay",
        referrer: "https://stariva.ru/checkout?email=a@b.ru",
        "violated-directive": "script-src-attr",
        "effective-directive": "script-src-attr",
        "original-policy": "default-src 'self'; script-src 'nonce-x'",
        disposition: "enforce",
        "blocked-uri": "inline",
        "line-number": 12,
        "column-number": 3,
        "source-file": "https://stariva.ru/order/8f1c2d0e-secret?token=abc",
        "script-sample": "alert('anna@example.com')",
        "status-code": 200,
      },
    }),
    "application/csp-report",
    { "user-agent": "Firefox/140" },
  );

  expect(response.status).toBe(204);
  expect(violations()).toEqual([
    [
      "csp.violation",
      {
        documentUrl: "https://stariva.ru/order/status",
        blockedUrl: "inline",
        directive: "script-src-attr",
        disposition: "enforce",
        sourceFile: "https://stariva.ru/order/status",
        line: 12,
        column: 3,
        sample: "alert('***')",
        userAgent: "Firefox/140",
      },
    ],
  ]);
});

test("a Reporting API batch logs each CSP violation and skips other report types", async () => {
  const response = await post(
    JSON.stringify([
      {
        type: "csp-violation",
        age: 10,
        url: "https://stariva.ru/catalog?utm_source=vk",
        user_agent: "Chrome/141",
        body: {
          documentURL: "https://stariva.ru/catalog?utm_source=vk",
          blockedURL:
            "https://adstat.yandex.ru/sync?uid=123&ref=https%3A%2F%2Fstariva.ru",
          effectiveDirective: "img-src",
          originalPolicy: "img-src 'self'",
          disposition: "enforce",
          statusCode: 200,
        },
      },
      {
        type: "csp-violation",
        body: {
          documentURL: "https://stariva.ru/api/video/hls/tok3n/index.m3u8",
          blockedURL: "data:image/png;base64,AAAA",
          effectiveDirective: "img-src",
          disposition: "report",
        },
      },
      { type: "deprecation", body: { id: "x", message: "y" } },
    ]),
    "application/reports+json",
  );

  expect(response.status).toBe(204);
  expect(violations().map(([, meta]) => meta)).toEqual([
    expect.objectContaining({
      documentUrl: "https://stariva.ru/catalog",
      blockedUrl: "https://adstat.yandex.ru/sync",
      directive: "img-src",
    }),
    expect.objectContaining({
      documentUrl: "https://stariva.ru/api/video/hls/:token/index.m3u8",
      blockedUrl: "data:",
      disposition: "report",
    }),
  ]);
});

test("an oversized body is refused without logging", async () => {
  const response = await post(
    JSON.stringify({ "csp-report": { pad: "x".repeat(40_000) } }),
    "application/csp-report",
  );
  expect(response.status).toBe(413);
  expect(warn).not.toHaveBeenCalled();
});

test("other content types and broken JSON are refused", async () => {
  expect((await post("{}", "text/plain")).status).toBe(415);
  expect((await post("{not json", "application/csp-report")).status).toBe(400);
  expect(warn).not.toHaveBeenCalled();
});

test("a body that is not a CSP report is accepted but not logged", async () => {
  const response = await post(
    JSON.stringify({ hello: "world" }),
    "application/json",
  );
  expect(response.status).toBe(204);
  expect(warn).not.toHaveBeenCalled();
});
