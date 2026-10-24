import { expect, test } from "bun:test";
import { moscowDateTime, recentRange } from "./common";
import { goalValues, searchQueryRow, statsRow } from "./direct";
import { HIT_FIELDS, hitRow, VISIT_FIELDS, visitRow } from "./metrika";

const syncedAt = new Date("2026-10-24T05:00:00Z");

test("dates follow Moscow time", () => {
  expect(recentRange(7, new Date("2026-10-24T22:30:00Z"))).toEqual({
    from: "2026-10-18",
    to: "2026-10-24",
  });
  expect(recentRange(1, new Date("2026-10-24T05:00:00Z"))).toEqual({
    from: "2026-10-23",
    to: "2026-10-23",
  });
  expect(moscowDateTime("2026-10-20 14:03:05")?.toISOString()).toBe(
    "2026-10-20T11:03:05.000Z",
  );
  expect(moscowDateTime("bad")).toBeNull();
});

test("requests every attribution model for visit sources", () => {
  for (const model of ["first", "last", "lastsign"]) {
    expect(VISIT_FIELDS).toContain(`ym:s:${model}DirectPhraseOrCond`);
  }
  expect(new Set(VISIT_FIELDS).size).toBe(VISIT_FIELDS.length);
  expect(new Set(HIT_FIELDS).size).toBe(HIT_FIELDS.length);
});

test("maps a Logs API visit to its columns", () => {
  const record = {
    visitID: "8765432109876543210",
    clientID: "1729374812345678901",
    dateTime: "2026-10-20 14:03:05",
    isNewUser: "1",
    pageViews: "4",
    visitDuration: "312",
    bounce: "0",
    lastsignTrafficSource: "ad",
    firstTrafficSource: "organic",
    lastsignDirectClickOrder: "715338803",
    lastsignDirectBannerGroup: "5812522590",
    lastsignDirectClickBanner: "1924972575417639329",
    lastsignDirectPhraseOrCond: "ёлка макраме мастер класс",
    regionCity: "Moscow",
    goalsID: [671496722],
    purchaseID: [],
  };
  expect(visitRow(record, syncedAt)).toMatchObject({
    visitId: "8765432109876543210",
    clientId: "1729374812345678901",
    startedAt: new Date("2026-10-20T11:03:05Z"),
    isNewUser: true,
    pageViews: 4,
    duration: 312,
    bounce: false,
    trafficSource: "ad",
    firstTrafficSource: "organic",
    directCampaignId: 715338803,
    directAdGroupId: 5812522590,
    directAdId: "1924972575417639329",
    directPhrase: "ёлка макраме мастер класс",
    city: "Moscow",
    goalIds: [671496722],
    purchaseIds: [],
    utmSource: null,
    data: record,
  });
});

test("treats zero ids as missing and skips rows without a time", () => {
  expect(
    visitRow(
      {
        visitID: "1",
        clientID: "0",
        dateTime: "2026-10-20 00:00:00",
        lastsignDirectClickOrder: "0",
      },
      syncedAt,
    ),
  ).toMatchObject({ clientId: null, directCampaignId: null });
  expect(visitRow({ visitID: "1" }, syncedAt)).toBeNull();
  expect(
    hitRow(
      { watchID: "5", dateTime: "2026-10-20 00:00:01", isPageView: "1" },
      syncedAt,
    ),
  ).toMatchObject({ watchId: "5", isPageView: true, goalIds: null });
});

test("reads per-goal conversions and revenue", () => {
  const record = {
    Conversions_671496722_AUTO: "2",
    Conversions_123_AUTO: "0",
    Revenue_671496722_AUTO: "1980",
  };
  expect(goalValues(record, "Conversions")).toEqual({
    "671496722": 2,
    "123": 0,
  });
  expect(goalValues(record, "Revenue")).toEqual({ "671496722": 1980 });
  expect(goalValues({ Conversions: "3" }, "Conversions")).toEqual({ all: 3 });
  expect(goalValues({}, "Revenue")).toBeNull();
});

test("maps Direct rows, keeping long ad ids as text", () => {
  const record = {
    Date: "2026-10-20",
    CampaignId: "715338803",
    AdId: "1924805229532764162",
    Age: "AGE_35_44",
    Gender: "GENDER_FEMALE",
    IncomeGrade: "ABOVE_AVERAGE",
    LocationOfPresenceId: "213",
    Impressions: "120",
    Clicks: "3",
    Cost: "87.45",
    Conversions_671496722_AUTO: "1",
  };
  expect(statsRow(record, syncedAt)).toMatchObject({
    date: "2026-10-20",
    campaignId: 715338803,
    adId: "1924805229532764162",
    age: "AGE_35_44",
    gender: "GENDER_FEMALE",
    incomeGrade: "ABOVE_AVERAGE",
    locationId: 213,
    impressions: 120,
    clicks: 3,
    cost: 87.45,
    sessions: null,
    conversions: { "671496722": 1 },
    revenue: null,
  });
  expect(
    searchQueryRow(
      { Date: "2026-10-20", Query: "ёлка из шнура своими руками" },
      syncedAt,
    ),
  ).toMatchObject({
    query: "ёлка из шнура своими руками",
    impressions: 0,
    clicks: 0,
    cost: 0,
  });
});
