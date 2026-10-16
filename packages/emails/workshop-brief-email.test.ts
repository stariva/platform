import { expect, test } from "bun:test";
import { render } from "@react-email/components";

import StarivaWorkshopEmail from "./emails/stariva-workshop";
import StarivaWorkshopBriefEmail, {
  workshopBriefEmailSubject,
} from "./emails/stariva-workshop-brief";

const accessUrl = "https://stariva.ru/api/workshops/access/abc";

test("brief email names the attached PDF and opens the account", async () => {
  const html = await render(
    StarivaWorkshopBriefEmail({
      workshopTitle: "Ёлка макраме",
      accessUrl,
      files: ["Бриф «Ёлка макраме»"],
    }),
  );
  expect(html).toContain("Бриф «Ёлка макраме» · PDF");
  expect(html).toContain(`href="${accessUrl}"`);
  expect(workshopBriefEmailSubject({ workshopTitle: "Ёлка макраме" })).toBe(
    "Бриф к мастер-классу «Ёлка макраме» — Stariva",
  );
});

test("purchase email mentions the brief only when it is attached", async () => {
  const props = {
    kind: "booked" as const,
    workshopTitle: "Ёлка макраме",
    releaseLabel: null,
    accessUrl,
    materials: [],
  };
  const withBrief = await render(
    StarivaWorkshopEmail({ ...props, attachedFiles: ["Бриф «Ёлка макраме»"] }),
  );
  expect(withBrief).toContain("Во вложении");
  expect(withBrief).toContain("Бриф «Ёлка макраме» · PDF");
  const without = await render(StarivaWorkshopEmail(props));
  expect(without).not.toContain("Во вложении");
});
