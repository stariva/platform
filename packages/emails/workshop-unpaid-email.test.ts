import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaWorkshopUnpaidEmail, {
  workshopUnpaidEmailSubject,
} from "./emails/stariva-workshop-unpaid";

const payUrl = "https://stariva.ru/elka-makrame?utm_source=email";

test("unpaid email links back to the course and reminds of the preorder", async () => {
  const html = await render(
    StarivaWorkshopUnpaidEmail({
      workshopTitle: "Ёлка макраме",
      payUrl,
      preorder: {
        deadlineLabel: "20 октября в 10:00 (мск)",
        priceLabel: "690 ₽",
        regularPriceLabel: "990 ₽",
        bonus: {
          title: "мастер-класс по большой ёлке",
          releaseLabel: "3 ноября",
        },
      },
    }),
  );
  expect(html).toContain("Оплата не завершилась");
  expect(html).toContain("это Ольга");
  expect(html).toContain(`href="${payUrl}"`);
  expect(html).toContain("690 ₽");
  expect(html).toContain("до 20 октября в 10:00 (мск)");
  expect(html).toContain("990 ₽");
  expect(html).toContain("мастер-класс по большой ёлке");
  expect(html).not.toContain("мастерская");
  expect(workshopUnpaidEmailSubject({ workshopTitle: "Ёлка макраме" })).toBe(
    "Оплата мастер-класса «Ёлка макраме» не завершилась — Stariva",
  );
});

test("unpaid email after the preorder skips the deadline", async () => {
  const html = await render(
    StarivaWorkshopUnpaidEmail({ workshopTitle: "Ёлка макраме", payUrl }),
  );
  expect(html).toContain("Завершить оплату");
  expect(html).not.toContain("Предзаказ");
});
