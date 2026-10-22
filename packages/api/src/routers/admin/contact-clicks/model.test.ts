import { expect, test } from "bun:test";
import type { SessionEntry } from "@stariva/db/schema";

import { clickSource, type SummaryClick, siteOf, summarize } from "./model";

const at = "2026-10-22T09:00:00.000Z";
const campaigns = [
  { id: "elka", utmSource: "yandex", utmCampaign: "elka_big" },
  { id: "vk", utmSource: "vk", utmCampaign: null },
];
const entry = (fields: Partial<SessionEntry> = {}): SessionEntry => ({
  landing: "/",
  at,
  ...fields,
});
const touch = (utm_source: string, utm_campaign?: string) => ({
  utm_source,
  utm_campaign,
  landing: "/",
  at,
});

test("метки этого захода важнее cookie", () => {
  expect(
    clickSource(
      entry({ utm_source: "Yandex", utm_campaign: "elka_big" }),
      { first: touch("vk"), last: touch("vk") },
      campaigns,
    ),
  ).toEqual({ kind: "campaign", campaignId: "elka", manual: false });
});

test("без меток в заходе — последняя реклама из cookie", () => {
  expect(
    clickSource(
      entry({ referrer: "google.com" }),
      { first: touch("yandex", "elka_big"), last: touch("vk", "autumn") },
      campaigns,
    ),
  ).toEqual({ kind: "campaign", campaignId: "vk", manual: false });
});

test("метка без кампании и заход не с рекламы", () => {
  expect(clickSource(entry({ utm_source: "email" }), null, campaigns)).toEqual({
    kind: "utm",
    utmSource: "email",
    utmCampaign: null,
  });
  expect(clickSource(null, null, campaigns)).toEqual({
    kind: "none",
    manual: false,
  });
});

test("откуда пришли без меток", () => {
  expect(siteOf(entry({ yclid: "1", referrer: "yandex.ru" }))).toBe(
    "Яндекс Директ без UTM-меток",
  );
  expect(siteOf(entry({ referrer: "www.google.com" }))).toBe("google.com");
  expect(siteOf(null)).toBe("Прямой заход");
});

test("сводка: люди по браузеру, расход и кампании без переходов", () => {
  const click = (
    id: string,
    browserId: string | null,
    fields: Partial<SessionEntry>,
    channel: SummaryClick["channel"] = "telegram",
  ): SummaryClick => ({
    id,
    browserId,
    ip: "1.2.3.4",
    channel,
    entry: entry(fields),
    attribution: null,
  });
  const summary = summarize(
    [
      click("1", "b1", { utm_source: "yandex", utm_campaign: "elka_big" }),
      click(
        "2",
        "b1",
        { utm_source: "yandex", utm_campaign: "elka_big" },
        "whatsapp",
      ),
      click("3", "b2", { utm_source: "yandex", utm_campaign: "elka_big" }),
      click("4", null, { referrer: "www.google.com" }),
    ],
    campaigns,
    new Map([
      ["elka", 150_000],
      ["vk", 50_000],
    ]),
  );
  expect(summary.total).toEqual({
    clicks: 4,
    people: 3,
    channels: { telegram: 3, whatsapp: 1, max: 0, phone: 0 },
  });
  expect(
    summary.sources.map((row) => [
      row.source.kind,
      row.clicks,
      row.people,
      row.spend,
    ]),
  ).toEqual([
    ["campaign", 3, 2, 150_000],
    ["campaign", 0, 0, 50_000],
    ["none", 1, 1, 0],
  ]);
  expect(summary.sites).toEqual([
    {
      site: "google.com",
      clicks: 1,
      people: 1,
      channels: { telegram: 1, whatsapp: 0, max: 0, phone: 0 },
    },
  ]);
});
