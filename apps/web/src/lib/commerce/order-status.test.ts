import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  isOrderActive,
  orderProgress,
  orderStatusLabel,
  orderStatusTone,
  paymentReturnState,
} from "./order-status";

const returned = (
  kind: "stock" | "made_to_order",
  status: string,
  extra: Partial<Parameters<typeof paymentReturnState>[0]> = {},
) =>
  paymentReturnState({
    kind,
    status,
    paid: false,
    paymentStep: null,
    paymentOverdue: false,
    ...extra,
  });

test("возврат с оплаты: зачтённая оплата подтверждена", () => {
  assert.equal(returned("stock", "paid", { paid: true }), "confirmed");
  // Оплаченный заказ из наличия тут же уходит в сборку Ozon
  assert.equal(returned("stock", "fulfilling", { paid: true }), "confirmed");
  assert.equal(returned("made_to_order", "in_production"), "confirmed");
  assert.equal(
    returned("made_to_order", "ready_to_ship", { paid: true }),
    "confirmed",
  );
});

test("возврат с оплаты: заказ ещё ждёт оплату — проверяем, а не радуемся", () => {
  assert.equal(returned("stock", "pending"), "checking");
  assert.equal(
    returned("made_to_order", "awaiting_deposit", {
      paymentStep: { type: "deposit", amount: 250000 },
    }),
    "checking",
  );
  assert.equal(
    returned("made_to_order", "awaiting_balance", { paymentOverdue: true }),
    "checking",
  );
});

test("возврат с оплаты: отменённый платёж и старая ссылка", () => {
  assert.equal(returned("stock", "canceled"), "failed");
  assert.equal(returned("stock", "delivered", { paid: true }), null);
  assert.equal(returned("made_to_order", "canceled"), null);
});

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
