import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import { campaignEmail, renderCampaignHtml } from "./campaign-email";
import { TELEGRAM_INVITE_SUBJECT } from "./emails/stariva-telegram-invite";

const campaign = {
  template: "telegram-invite",
  params: { channelUrl: "https://t.me/example" },
};

test("campaignEmail sends the button through the site, not to the channel", async () => {
  const email = campaignEmail(campaign, {
    siteUrl: "https://stariva.example.test/",
    token: "tok123",
  });
  const html = await render(email.react);
  expect(html).toContain('href="https://stariva.example.test/api/m/c/tok123"');
  expect(html).not.toContain("https://t.me/example");
  expect(email.headers["List-Unsubscribe"]).toBe(
    "<https://stariva.example.test/api/m/u/tok123>",
  );
});

test("campaignEmail takes the subject from the template", () => {
  const email = campaignEmail(campaign, {
    siteUrl: "https://stariva.example.test",
    token: "tok123",
  });
  expect(email.subject).toBe(TELEGRAM_INVITE_SUBJECT);
});

test("the reason line depends on where the recipient came from", async () => {
  const options = { siteUrl: "https://stariva.example.test", token: "tok123" };
  const buyer = await render(campaignEmail(campaign, options).react);
  const manual = await render(
    campaignEmail(campaign, { ...options, source: "manual" }).react,
  );
  expect(buyer).toContain("вы купили мастер-класс");
  expect(manual).toContain("ваш адрес есть в рассылке Stariva");
  expect(manual).not.toContain("вы купили мастер-класс");
});

test("a draft without its fields previews with the template example", async () => {
  const html = await renderCampaignHtml(
    { template: "telegram-invite", params: {} },
    "https://stariva.example.test",
  );
  expect(html).toContain("Перейти в канал");
  expect(html).toContain(
    'href="https://stariva.example.test/api/m/c/test-preview"',
  );
});
