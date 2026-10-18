import assert from "node:assert/strict";
import { test } from "node:test";
import { textDiff, watchHydrationMismatch } from "./hydration-diagnostics";

test("textDiff keeps only the lines that differ", () => {
  assert.deepEqual(
    textDiff(
      ["Ёлка макраме", "Предзаказ за 690 ₽", "Отзывы"],
      ["Ёлка макраме", "Предзаказ за 690 ₽", "Отзывы", "Купить"],
    ),
    { server_only: [], client_only: ["Купить"] },
  );
  assert.deepEqual(
    textDiff(["3 декабря 2025 г.", "3 декабря 2025 г."], ["4 декабря 2025 г."]),
    {
      server_only: ["3 декабря 2025 г.", "3 декабря 2025 г."],
      client_only: ["4 декабря 2025 г."],
    },
  );
});

test("textDiff compares occurrence counts in both directions", () => {
  assert.deepEqual(textDiff(["A", "A", "A", "B"], ["A", "B", "B", "B"]), {
    server_only: ["A", "A"],
    client_only: ["B", "B"],
  });
  assert.deepEqual(textDiff(["A", "A", "B"], ["B", "A", "A"]), {
    server_only: [],
    client_only: [],
  });
});

test("textDiff caps the number and length of lines", () => {
  const server = Array.from({ length: 20 }, (_, i) => `${i}`.padEnd(300, "x"));
  const { server_only } = textDiff(server, []);
  assert.equal(server_only.length, 8);
  assert.equal(server_only[0]?.length, 160);
  assert.deepEqual(
    textDiff([], Array(20).fill("A")).client_only,
    Array(8).fill("A"),
  );
});

test("watchHydrationMismatch merges maximum counts and sanitizes report paths", async (t) => {
  const globals = ["document", "window", "NodeFilter"] as const;
  const originals = globals.map((key) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  t.after(() => {
    globals.forEach((key, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  });

  for (const [pathname, path] of [
    ["/order/secret/pay", "/order/status/pay"],
    ["/api/video/hls/secret/index.m3u8", "/api/video/hls/:token/index.m3u8"],
    ["/api/workshops/access/secret", "/api/workshops/access/:token"],
    ["/catalog/clothes", "/catalog/clothes"],
  ]) {
    let lines = ["shared", "shared", "early", "early"];
    const parentElement = { tagName: "DIV", closest: () => null };
    const doc = Object.assign(new EventTarget(), {
      body: {},
      readyState: "loading",
      documentElement: { lang: "ru", className: "light" },
      createTreeWalker: () => {
        const nodes = lines.map((nodeValue) => ({ nodeValue, parentElement }));
        return { nextNode: () => nodes.shift() ?? null };
      },
    });
    const win = Object.assign(new EventTarget(), { location: { pathname } });
    Object.defineProperties(globalThis, {
      document: { value: doc, configurable: true },
      window: { value: win, configurable: true },
      NodeFilter: { value: { SHOW_TEXT: 4 }, configurable: true },
    });
    const reports: Record<string, unknown>[] = [];
    watchHydrationMismatch((properties) => reports.push(properties));
    lines = ["shared", "shared", "early", "late", "late", "late"];
    doc.dispatchEvent(new Event("DOMContentLoaded"));
    lines = ["shared", "shared", "early", "late", "late", "client", "client"];
    win.dispatchEvent(
      Object.assign(new Event("error"), {
        message: "Minified React error #418",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(reports, [
      {
        error_code: "418",
        server_only: ["early", "late"],
        client_only: ["client", "client"],
        html_lang: "ru",
        html_class: "light",
        path,
      },
    ]);
  }
});
