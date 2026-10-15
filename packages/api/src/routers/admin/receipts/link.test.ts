import { expect, test } from "bun:test";

import { checkReceipt, parseReceiptLink } from "./link";

const PRINT =
  "https://lknpd.nalog.ru/api/v1/receipt/502480197143/203e2ralw5/print";

test("parses the link «Мой налог» shares", () => {
  expect(parseReceiptLink(` ${PRINT} `)).toEqual({
    inn: "502480197143",
    number: "203e2ralw5",
    url: PRINT,
  });
});

test("normalizes json and bare links to the print image", () => {
  expect(
    parseReceiptLink(
      "https://lknpd.nalog.ru/api/v1/receipt/502480197143/203E2RALW5/json",
    )?.url,
  ).toBe(PRINT);
  expect(
    parseReceiptLink(
      "https://lknpd.nalog.ru/api/v1/receipt/502480197143/203e2ralw5",
    )?.url,
  ).toBe(PRINT);
});

test("rejects links that are not receipts", () => {
  expect(parseReceiptLink("203e2ralw5")).toBeNull();
  expect(
    parseReceiptLink("https://evil.test/api/v1/receipt/502480197143/a/print"),
  ).toBeNull();
  expect(
    parseReceiptLink("https://lknpd.nalog.ru/api/v1/receipt/5024/a/print"),
  ).toBeNull();
  expect(parseReceiptLink("https://lknpd.nalog.ru/")).toBeNull();
});

const respond = (status: number, type: string) =>
  (async () =>
    new Response("x", {
      status,
      headers: { "content-type": type },
    })) as unknown as typeof fetch;

test("an image means the receipt exists", async () => {
  expect(await checkReceipt(PRINT, respond(200, "image/png"))).toBe("found");
});

test("422 from the tax service means no such receipt", async () => {
  expect(await checkReceipt(PRINT, respond(422, "application/json"))).toBe(
    "not_found",
  );
});

test("outages are not mistaken for a missing receipt", async () => {
  expect(await checkReceipt(PRINT, respond(502, "text/html"))).toBe(
    "unavailable",
  );
  const failing = (async () => {
    throw new Error("network");
  }) as unknown as typeof fetch;
  expect(await checkReceipt(PRINT, failing)).toBe("unavailable");
});
