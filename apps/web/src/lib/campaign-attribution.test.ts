import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCampaign } from "./campaign-attribution";
test("campaign attribution only accepts bounded UTM parameters", () => {
  assert.deepEqual(
    parseCampaign(
      "https://stariva.ru/?utm_source=instagram&utm_campaign=blogger&email=private&token=secret#order",
    ),
    { utm_source: "instagram", utm_campaign: "blogger" },
  );
  assert.equal(
    parseCampaign(`https://stariva.ru/?utm_content=${"a".repeat(1000)}`)
      .utm_content?.length,
    120,
  );
  assert.deepEqual(parseCampaign("invalid"), {});
});
