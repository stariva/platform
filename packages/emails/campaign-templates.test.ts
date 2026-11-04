import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import {
  CAMPAIGN_TEMPLATE_IDS,
  campaignButtonUrl,
  campaignParamsError,
  campaignTemplate,
  campaignTemplateList,
} from "./campaign-templates";

const links = {
  clickUrl: "https://stariva.example.test/api/m/c/t1",
  reason:
    "Вы получили это письмо, потому что купили мастер-класс на stariva.ru.",
  buyer: true,
  unsubscribeUrl: "https://stariva.example.test/unsubscribe/t1",
  openPixelUrl: "https://stariva.example.test/api/m/o/t1",
};

test("every template renders with the tracked button, unsubscribe and pixel", async () => {
  for (const id of CAMPAIGN_TEMPLATE_IDS) {
    const template = campaignTemplate(id);
    const params = Object.fromEntries(
      template.fields.map((field) => [field.name, "https://t.me/example"]),
    );
    const html = await render(
      template.render({ ...links, params: template.params.parse(params) }),
    );
    expect(html).toContain(`href="${links.clickUrl}"`);
    expect(html).toContain(`href="${links.unsubscribeUrl}"`);
    expect(html).toContain(`src="${links.openPixelUrl}"`);
    // Настоящий адрес канала в письме не светится: только через сайт
    expect(html).not.toContain("https://t.me/example");
  }
});

test("the Telegram invite speaks as Olga and does not sell", async () => {
  const template = campaignTemplate("telegram-invite");
  const html = await render(
    template.render({
      ...links,
      params: { channelUrl: "https://t.me/example" },
    }),
  );
  expect(html).toContain("Это Ольга");
  expect(html).toContain("Перейти в канал");
  // Ольга работает одна: канал «свой», не «наш»; без «мастерской» и продажи
  // («купили мастер-класс» в строке «почему пришло письмо» — не продажа)
  expect(html).not.toMatch(
    /наш(?:\s|[аеиу])|мастерск|купите|оплатите|скидк|цена|цены/i,
  );
  // Служебную ссылку через сайт под кнопкой не показываем
  expect(html).not.toContain("Если кнопка не работает");
});

test("validates params against the template fields", () => {
  expect(
    campaignParamsError("telegram-invite", { channelUrl: "https://t.me/x" }),
  ).toBeNull();
  expect(campaignParamsError("telegram-invite", { channelUrl: "t.me/x" })).toBe(
    "Проверьте поле «Ссылка на канал»",
  );
  expect(campaignParamsError("telegram-invite", {})).toBe(
    "Проверьте поле «Ссылка на канал»",
  );
  expect(campaignParamsError("missing", {})).toBe("Такого письма нет");
});

test("the button leads to the channel from the campaign params", () => {
  expect(
    campaignButtonUrl({
      template: "telegram-invite",
      params: { channelUrl: "https://t.me/x" },
    }),
  ).toBe("https://t.me/x");
  expect(
    campaignButtonUrl({
      template: "telegram-invite",
      params: { channelUrl: "javascript:alert(1)" },
    }),
  ).toBeNull();
  expect(campaignButtonUrl({ template: "missing", params: {} })).toBeNull();
});

test("the admin list carries no functions", () => {
  const [first] = campaignTemplateList();
  expect(first?.id).toBe("telegram-invite");
  expect(JSON.parse(JSON.stringify(campaignTemplateList()))).toEqual(
    campaignTemplateList(),
  );
});
