import { expect, test } from "bun:test";
import { readJsonBody } from "./read-json";

const post = (body: BodyInit, headers?: HeadersInit) =>
  new Request("https://example.test/api", { method: "POST", body, headers });

test("a body within the limit is parsed", async () => {
  expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ a: 1 });
});

test("a declared oversized body is refused before reading", async () => {
  const request = post("{}", { "content-length": "5000" });
  expect(await readJsonBody(request, 100)).toBe("too_large");
});

test("a streamed body is cut off at the limit", async () => {
  // Без content-length: размер узнаём только по ходу чтения
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(new TextEncoder().encode("x".repeat(50)));
      }
      controller.close();
    },
  });
  const request = new Request("https://example.test/api", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  expect(await readJsonBody(request, 100)).toBe("too_large");
});

test("not JSON is null", async () => {
  expect(await readJsonBody(post("not json"), 100)).toBeNull();
});
