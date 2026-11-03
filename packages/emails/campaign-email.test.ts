import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaCampaignEmail, {
  campaignParagraphs,
} from "./emails/stariva-campaign";

test("splits the body into paragraphs on blank lines", () => {
  expect(
    campaignParagraphs("Привет.\r\n\r\n Строка один\nстрока два \n\n\n\nКонец"),
  ).toEqual([["Привет."], ["Строка один", "строка два"], ["Конец"]]);
  expect(campaignParagraphs("  \n\n ")).toEqual([]);
});

test("renders the button, the unsubscribe link and the open pixel", async () => {
  const html = await render(
    StarivaCampaignEmail({
      previewText: "",
      heading: "Приглашаю в сообщество",
      body: "Здравствуйте, это Ольга.\n\nВторой абзац\nс переносом.",
      buttonLabel: "Перейти в канал",
      buttonUrl: "https://stariva.example.test/api/m/c/t1",
      reason: "Письмо пришло, потому что вы купили мастер-класс.",
      unsubscribeUrl: "https://stariva.example.test/unsubscribe/t1",
      openPixelUrl: "https://stariva.example.test/api/m/o/t1",
    }),
  );
  expect(html).toContain('href="https://stariva.example.test/api/m/c/t1"');
  expect(html).toContain('href="https://stariva.example.test/unsubscribe/t1"');
  expect(html).toContain('src="https://stariva.example.test/api/m/o/t1"');
  expect(html).toContain("Второй абзац<br/>с переносом.");
  // Без строки-превью во «Входящих» видно начало текста
  expect(html).toContain("Здравствуйте, это Ольга.");
});

test("omits the button when it has no link", async () => {
  const html = await render(
    StarivaCampaignEmail({
      previewText: "Превью",
      heading: "Новости",
      body: "Текст",
      buttonLabel: "Кнопка",
      buttonUrl: null,
      reason: "Причина",
      unsubscribeUrl: "https://stariva.example.test/unsubscribe/t1",
    }),
  );
  expect(html).not.toContain("Кнопка");
  expect(html).not.toContain("api/m/o/");
});
