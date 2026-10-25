import { expect, test } from "bun:test";
import { saveCampaign } from "./campaigns";

const schema = saveCampaign["~orpc"].inputSchemas[0];
const campaign = {
  name: "Кампания",
  channel: "vk_ads",
  utmSource: "",
  utmCampaign: "",
  notes: "",
};

test.each([undefined, "existing-campaign"])(
  "VK campaign rejects a Direct link on save (id: %s)",
  (id) => {
    for (const directCampaignId of ["123", " 123 ", "0"]) {
      const result = schema.safeParse({ ...campaign, id, directCampaignId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["directCampaignId"]);
      }
    }
  },
);

test.each([undefined, "", "   "])(
  "VK campaign accepts an absent or empty Direct link (%j)",
  (directCampaignId) => {
    expect(schema.safeParse({ ...campaign, directCampaignId }).success).toBe(
      true,
    );
  },
);

test.each([
  "yandex_direct",
  "telegram",
  "avito",
  "bloggers",
  "social",
  "other",
])("Direct link validation for %s is preserved", (channel) => {
  expect(
    schema.parse({ ...campaign, channel, directCampaignId: " 123 " }),
  ).toMatchObject({ directCampaignId: 123 });
  for (const directCampaignId of ["abc", "1234567890123456"]) {
    expect(
      schema.safeParse({ ...campaign, channel, directCampaignId }).success,
    ).toBe(false);
  }
});
