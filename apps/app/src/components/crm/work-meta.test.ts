import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyOrderFields, orderInput } from "./order-fields";
import { presetRange, resolvePeriod } from "./period";
import { parseRubles } from "./work-meta";

test("рубли: десятичные разделители, группировка тысяч, пустое поле и ноль", () => {
  for (const value of [
    "12 000,50",
    "12\u00a0000.50",
    "12\u202f000,50",
    "12000.5",
  ]) {
    assert.equal(parseRubles(value), 12000.5);
  }
  for (const value of ["", "  ", "0", "0,00", "0.00"]) {
    assert.equal(parseRubles(value), 0);
  }
});

test("ошибки ввода денег не подменяются нулём и не попадают во вход заказа", () => {
  for (const value of [
    "abc",
    "1,2,3",
    "1.2.3",
    "12 34",
    "1,000.50",
    "1.001",
    "-1",
    "Infinity",
    "0x10",
    "1e3",
    "9".repeat(400),
  ]) {
    assert.equal(parseRubles(value), null);
    assert.equal(orderInput(emptyOrderFields({ amount: value })), null);
    assert.equal(orderInput(emptyOrderFields({ fee: value })), null);
  }
  assert.partialDeepStrictEqual(
    orderInput(emptyOrderFields({ amount: "0", fee: "0" })),
    {
      amount: 0,
      fee: 0,
    },
  );
});

test("обратный пользовательский период нормализуется, неполный сохраняется", () => {
  assert.partialDeepStrictEqual(
    resolvePeriod({ from: "2026-10-16", to: "2026-10-01" }),
    {
      preset: null,
      range: { from: "2026-10-01", to: "2026-10-16" },
    },
  );
  assert.deepEqual(resolvePeriod({ from: "2026-10-01" }).range, {
    from: "2026-10-01",
    to: undefined,
  });
  assert.deepEqual(resolvePeriod({ from: "invalid", to: "2026-10-16" }).range, {
    from: undefined,
    to: "2026-10-16",
  });
  const preset = resolvePeriod({ period: "prev" });
  assert.equal(preset.preset, "prev");
  assert.deepEqual(preset.range, presetRange("prev", preset.today));
});
