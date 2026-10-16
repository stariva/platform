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

const failingWith = (error: Error) =>
  (async () => {
    throw error;
  }) as unknown as typeof fetch;

// Без пауз между попытками, чтобы тесты не ждали
const once = (fetchImpl: typeof fetch) => ({
  fetchImpl,
  attempts: 1,
  delayMs: 0,
});
const retrying = (fetchImpl: typeof fetch) => ({
  fetchImpl,
  attempts: 3,
  delayMs: 0,
});

test("an image means the receipt exists", async () => {
  expect(await checkReceipt(PRINT, once(respond(200, "image/png")))).toEqual({
    status: "found",
  });
});

test("422 from the tax service means no such receipt", async () => {
  expect(
    await checkReceipt(PRINT, once(respond(422, "application/json"))),
  ).toEqual({ status: "not_found" });
});

test("outages are not mistaken for a missing receipt, and say why", async () => {
  expect(await checkReceipt(PRINT, once(respond(502, "text/html")))).toEqual({
    status: "unavailable",
    reason: "сервис ответил ошибкой 502",
  });
  expect(await checkReceipt(PRINT, once(respond(200, "text/html")))).toEqual({
    status: "unavailable",
    reason: "вместо картинки чека пришёл другой ответ (text/html)",
  });

  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  expect(
    await checkReceipt(PRINT, {
      ...once(failingWith(timeout)),
      timeoutMs: 5000,
    }),
  ).toEqual({
    status: "unavailable",
    reason: "сервис не ответил за 5 с",
  });

  const refused = new Error("fetch failed", {
    cause: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }),
  });
  expect(await checkReceipt(PRINT, once(failingWith(refused)))).toEqual({
    status: "unavailable",
    reason: "нет соединения (ECONNREFUSED)",
  });
  expect(await checkReceipt(PRINT, once(failingWith(new Error("x"))))).toEqual({
    status: "unavailable",
    reason: "нет соединения",
  });
});

test("a one-off hang is retried and the receipt is still found", async () => {
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls === 1) throw timeout;
    return new Response("x", {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  }) as unknown as typeof fetch;
  expect(await checkReceipt(PRINT, retrying(flaky))).toEqual({
    status: "found",
  });
  expect(calls).toBe(2);
});

test("a final answer is not retried", async () => {
  let calls = 0;
  const missing = (async () => {
    calls++;
    return new Response("x", {
      status: 422,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  expect(await checkReceipt(PRINT, retrying(missing))).toEqual({
    status: "not_found",
  });
  expect(calls).toBe(1);
});

test("gives up after the last attempt and says how many were made", async () => {
  let calls = 0;
  const down = (async () => {
    calls++;
    return new Response("x", {
      status: 503,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
  expect(await checkReceipt(PRINT, retrying(down))).toEqual({
    status: "unavailable",
    reason: "сервис ответил ошибкой 503, попыток: 3",
  });
  expect(calls).toBe(3);
});
