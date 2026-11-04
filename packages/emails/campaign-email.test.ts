import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import { campaignEmail } from "./campaign-email";
import { TELEGRAM_INVITE_SUBJECT } from "./emails/stariva-telegram-invite";

const campaign = {
  template: "telegram-invite",
  params: { channelUrl: "https://t.me/example" },
  segment: { type: "workshop_buyers" as const, workshops: [] },
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
