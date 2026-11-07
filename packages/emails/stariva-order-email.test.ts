import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaOrderEmail, {
  type StarivaOrderEmailProps,
} from "./emails/stariva-order";

const base: StarivaOrderEmailProps = {
  status: "awaiting_balance",
  orderNumber: 1042,
  orderUrl: "https://stariva.ru/order/abc",
  items: [{ name: "Ёлка", quantity: 1, image: null }],
  amountTotal: 390_000,
  amountDelivery: 0,
  depositAmount: 195_000,
  leadTime: null,
  paymentDueLabel: "10 ноября",
  trackingNumber: null,
  declineReason: null,
  deliveryQuoteNeeded: false,
};

// Пробелы в суммах в письме неразрывные, поэтому сравниваем без них
const plain = (html: string) => html.replace(/[\s  ]+/g, " ");

test("the finished product asks to pick a pickup point while the delivery is not priced", async () => {
  const html = plain(
    await render(StarivaOrderEmail({ ...base, deliveryQuoteNeeded: true })),
  );

  expect(html).toContain("Выберите на странице заказа пункт выдачи Ozon");
  expect(html).toContain("сайт сразу посчитает доставку");
  // Кнопка ведёт к выбору пункта, а не к оплате, и сумма названа без доставки
  expect(html).toContain("Выбрать пункт выдачи");
  expect(html).not.toContain("Внести доплату");
  expect(html).toContain("и доставка Ozon");
  expect(html).toContain('href="https://stariva.ru/order/abc"');
});

test("the finished product with the delivery priced asks only to pay", async () => {
  const html = plain(
    await render(
      StarivaOrderEmail({
        ...base,
        amountDelivery: 45_000,
        amountTotal: 435_000,
      }),
    ),
  );

  expect(html).toContain("Внесите доплату");
  expect(html).toContain("Внести доплату");
  expect(html).not.toContain("Выбрать пункт выдачи");
  expect(html).not.toContain("и доставка Ozon");
});

test("the deposit letter says the pickup point comes later and has no point button", async () => {
  const html = plain(
    await render(
      StarivaOrderEmail({
        ...base,
        status: "awaiting_deposit",
        amountTotal: 640_000,
        amountDelivery: 0,
      }),
    ),
  );

  expect(html).toContain("Внесите предоплату");
  expect(html).toContain("выберете позже, когда изделие будет готово");
  expect(html).not.toContain("Выбрать пункт выдачи");
});
