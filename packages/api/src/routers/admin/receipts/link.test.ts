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
  expect(await checkReceipt(PRINT, respond(200, "image/png"))).toEqual({
    status: "found",
  });
});

test("422 from the tax service means no such receipt", async () => {
  expect(await checkReceipt(PRINT, respond(422, "application/json"))).toEqual({
    status: "not_found",
  });
});

const failingWith = (error: Error) =>
  (async () => {
    throw error;
  }) as unknown as typeof fetch;

test("outages are not mistaken for a missing receipt, and say why", async () => {
  expect(await checkReceipt(PRINT, respond(502, "text/html"))).toEqual({
    status: "unavailable",
    reason: "сервис ответил ошибкой 502",
  });
  expect(await checkReceipt(PRINT, respond(200, "text/html"))).toEqual({
    status: "unavailable",
    reason: "вместо картинки чека пришёл другой ответ (text/html)",
  });

  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  expect(await checkReceipt(PRINT, failingWith(timeout))).toEqual({
    status: "unavailable",
    reason: "сервис не ответил за 10 секунд",
  });

  const refused = new Error("fetch failed", {
    cause: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }),
  });
  expect(await checkReceipt(PRINT, failingWith(refused))).toEqual({
    status: "unavailable",
    reason: "нет соединения (ECONNREFUSED)",
  });
  expect(await checkReceipt(PRINT, failingWith(new Error("x")))).toEqual({
    status: "unavailable",
    reason: "нет соединения",
  });
});
