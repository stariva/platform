import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  isOrderActive,
  orderProgress,
  orderStatusLabel,
  orderStatusTone,
} from "./order-status";

test("мастер-класс без шкалы этапов", () => {
  assert.equal(orderProgress("workshop", "paid"), null);
});

test("готовое изделие проходит пять этапов", () => {
  assert.deepEqual(orderProgress("stock", "fulfilling"), {
    steps: ["Оформлен", "Оплачен", "Собирается", "В пути", "Получен"],
    reached: 2,
  });
  // Ручная обработка для покупателя — тот же этап, что и обычная оплата
  assert.equal(orderProgress("stock", "ozon_order_failed")?.reached, 1);
});

test("под заказ: полностью оплаченный ждёт отправки на этапе «Готов»", () => {
  const progress = orderProgress("made_to_order", "ready_to_ship");
  assert.equal(progress?.steps[progress.reached], "Готов");
});

test("отменённый и отклонённый заказ без шкалы", () => {
  assert.equal(orderProgress("stock", "canceled"), null);
  assert.equal(orderProgress("made_to_order", "declined"), null);
});

test("ожидание оплаты требует внимания покупателя", () => {
  assert.equal(orderStatusTone("stock", "pending"), "attention");
  assert.equal(
    orderStatusTone("made_to_order", "awaiting_balance"),
    "attention",
  );
  assert.equal(orderStatusTone("made_to_order", "in_production"), "progress");
});

test("оплаченный мастер-класс завершён, оплаченное изделие — ещё в работе", () => {
  assert.equal(orderStatusTone("workshop", "paid"), "success");
  assert.equal(isOrderActive("workshop", "paid"), false);
  assert.equal(isOrderActive("stock", "paid"), true);
  assert.equal(isOrderActive("stock", "delivered"), false);
  assert.equal(isOrderActive("made_to_order", "declined"), false);
});

test("подпись статуса зависит от вида заказа", () => {
  assert.equal(orderStatusLabel("workshop", "paid"), "Доступ открыт");
  assert.equal(orderStatusLabel("stock", "paid"), "Оплачен");
  assert.equal(orderStatusLabel("stock", "unknown_status"), "unknown_status");
});
