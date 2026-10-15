import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaReceiptEmail, {
  receiptEmailSubject,
} from "./emails/stariva-receipt";

const props = {
  subject: "заказу №1042",
  receiptNumber: "203e2ralw5",
  receiptUrl:
    "https://lknpd.nalog.ru/api/v1/receipt/502480197143/203e2ralw5/print",
};

test("shows the receipt image and links to it", async () => {
  const html = await render(StarivaReceiptEmail(props));
  expect(html).toContain(`src="${props.receiptUrl}"`);
  expect(html).toContain(`href="${props.receiptUrl}"`);
  expect(html).toContain("Чек №203e2ralw5");
  expect(receiptEmailSubject(props)).toBe("Чек по заказу №1042 — Stariva");
});
