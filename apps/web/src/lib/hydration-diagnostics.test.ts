import assert from "node:assert/strict";
import { test } from "node:test";
import { textDiff } from "./hydration-diagnostics";

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
    { server_only: ["3 декабря 2025 г."], client_only: ["4 декабря 2025 г."] },
  );
});

test("textDiff caps the number and length of lines", () => {
  const server = Array.from({ length: 20 }, (_, i) => `${i}`.padEnd(300, "x"));
  const { server_only } = textDiff(server, []);
  assert.equal(server_only.length, 8);
  assert.equal(server_only[0]?.length, 160);
});
