import { expect, test } from "bun:test";
import { campaignEmailSchema, parseCampaignEmails } from "./campaign";

test("splits, lowercases and dedupes manual campaign addresses", () => {
  expect(
    parseCampaignEmails(
      "Anna@Example.ru, maria@example.ru;\nanna@example.ru  oops",
    ),
  ).toEqual({
    emails: ["anna@example.ru", "maria@example.ru"],
    invalid: ["oops"],
  });
  expect(parseCampaignEmails("  \n ")).toEqual({ emails: [], invalid: [] });
});

test("an address the server would reject is shown as invalid", () => {
  const tooLong = `${"a".repeat(245)}@example.ru`;
  expect(campaignEmailSchema.safeParse(tooLong).success).toBe(false);
  expect(parseCampaignEmails(tooLong)).toEqual({
    emails: [],
    invalid: [tooLong],
  });
});
