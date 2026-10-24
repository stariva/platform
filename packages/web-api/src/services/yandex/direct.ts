import { createHash } from "node:crypto";
import { and, asc, db, gte, lte } from "@stariva/db";
import {
  directSearchQueries,
  directStats,
  type GoalValues,
  metrikaGoals,
} from "@stariva/db/schema";
import { env } from "../../env";
import { chunks, type DateRange, responseDetail, sleep } from "./common";
import { parseDirectTsv } from "./tsv";

const REPORTS_URL = "https://api.direct.yandex.com/json/v5/reports";
const INSERT_BATCH = 500;
// Reports API принимает не больше 10 целей в одном отчёте
const MAX_GOALS = 10;

export function isDirectConfigured(): boolean {
  return !!env.YANDEX_DIRECT_TOKEN;
}

/** Директ ещё строит отчёт: повтор с теми же параметрами заберёт его. */
export class DirectReportPendingError extends Error {
  constructor(readonly reportName: string) {
    super(`direct_report_pending: ${reportName}`);
  }
}

export type DirectReport = "stats" | "search_queries";

const METRICS = [
  "Impressions",
  "Clicks",
  "Cost",
  "Bounces",
  "Conversions",
  "Revenue",
];

/**
 * Все срезы CUSTOM_REPORT сразу: по таблице можно потом сложить любой —
 * пол × возраст, доход × площадка, регион × устройство и т. д.
 */
const REPORTS: Record<
  DirectReport,
  { type: string; dimensions: string[]; metrics: string[] }
> = {
  stats: {
    type: "CUSTOM_REPORT",
    dimensions: [
      "Date",
      "CampaignId",
      "CampaignName",
      "CampaignType",
      "AdGroupId",
      "AdGroupName",
      "AdId",
      "AdFormat",
      "CriterionId",
      "Criterion",
      "CriterionType",
      "MatchType",
      "TargetingCategory",
      "Age",
      "Gender",
      "IncomeGrade",
      "Device",
      "MobilePlatform",
      "CarrierType",
      "LocationOfPresenceId",
      "LocationOfPresenceName",
      "TargetingLocationId",
      "TargetingLocationName",
      "AdNetworkType",
      "Placement",
      "ExternalNetworkName",
      "Slot",
    ],
    metrics: [...METRICS, "Sessions"],
  },
  search_queries: {
    type: "SEARCH_QUERY_PERFORMANCE_REPORT",
    dimensions: [
      "Date",
      "CampaignId",
      "CampaignName",
      "AdGroupId",
      "AdGroupName",
      "AdId",
      "Query",
      "CriterionId",
      "Criterion",
      "CriterionType",
      "MatchedKeyword",
      "MatchType",
      "TargetingCategory",
      "IncomeGrade",
      "Placement",
    ],
    metrics: METRICS,
  },
};

/**
 * Цели для конверсий: из YANDEX_DIRECT_GOAL_IDS, иначе первые 10 целей
 * счётчика — сначала JavaScript-события (оплаты, заявки), потом остальные.
 */
async function reportGoals(): Promise<string[]> {
  if (env.YANDEX_DIRECT_GOAL_IDS)
    return env.YANDEX_DIRECT_GOAL_IDS.split(",").slice(0, MAX_GOALS);
  const goals = await db
    .select({ id: metrikaGoals.id, type: metrikaGoals.type })
    .from(metrikaGoals)
    .orderBy(asc(metrikaGoals.id));
  return goals
    .sort((a, b) => Number(b.type === "action") - Number(a.type === "action"))
    .slice(0, MAX_GOALS)
    .map((goal) => String(goal.id));
}

/** Имя отчёта уникально для набора параметров: Директ кэширует по имени. */
function reportName(report: DirectReport, range: DateRange, params: unknown) {
  const hash = createHash("sha1")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 10);
  return `stariva ${report} ${range.from}..${range.to} ${hash}`;
}

/**
 * Готовый TSV отчёта. Reports API отвечает 201/202, пока строит отчёт, и
 * подсказывает в retryIn, когда спросить снова; ждём до `waitMs`.
 */
async function fetchReport(
  report: DirectReport,
  range: DateRange,
  goals: string[],
  waitMs: number,
): Promise<string> {
  const token = env.YANDEX_DIRECT_TOKEN;
  if (!token) throw new Error("direct_not_configured");
  const { type, dimensions, metrics } = REPORTS[report];
  const params = {
    SelectionCriteria: { DateFrom: range.from, DateTo: range.to },
    FieldNames: [...dimensions, ...metrics],
    ReportType: type,
    DateRangeType: "CUSTOM_DATE",
    Format: "TSV",
    IncludeVAT: "YES",
    ...(goals.length ? { Goals: goals, AttributionModels: ["AUTO"] } : {}),
  };
  const name = reportName(report, range, params);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Accept-Language": "ru",
    "Content-Type": "application/json; charset=utf-8",
    processingMode: "auto",
    returnMoneyInMicros: "false",
    skipReportHeader: "true",
    skipReportSummary: "true",
  };
  if (env.YANDEX_DIRECT_CLIENT_LOGIN)
    headers["Client-Login"] = env.YANDEX_DIRECT_CLIENT_LOGIN;

  const deadline = Date.now() + waitMs;
  while (true) {
    const res = await fetch(REPORTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ params: { ...params, ReportName: name } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status === 200) return res.text();
    if (res.status !== 201 && res.status !== 202) {
      throw new Error(
        `direct_report_failed_${res.status}: ${await responseDetail(res)}`,
      );
    }
    const retryIn = Number(res.headers.get("retryIn")) || 10;
    const delay = Math.min(Math.max(retryIn, 5), 60) * 1000;
    if (Date.now() + delay > deadline) throw new DirectReportPendingError(name);
    await sleep(delay);
  }
}

const text = (value: string | undefined) => value ?? null;
const int = (value: string | undefined) => {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};
const safeId = (value: string | undefined) => {
  const number = int(value);
  return number !== null && Number.isSafeInteger(number) ? number : null;
};
const money = (value: string | undefined) => {
  const number = Number(value);
  return value !== undefined && Number.isFinite(number) ? number : 0;
};

/**
 * Конверсии или доход по целям. С Goals Директ отдаёт колонки
 * Conversions_<цель>_<модель>; без них — одну Conversions по целям кампании.
 */
export function goalValues(
  record: Record<string, string>,
  metric: "Conversions" | "Revenue",
): GoalValues | null {
  const values: GoalValues = {};
  for (const [key, value] of Object.entries(record)) {
    const match = new RegExp(`^${metric}(?:_(\\d+)_[A-Z]+)?$`).exec(key);
    if (!match) continue;
    const number = Number(value);
    if (Number.isFinite(number)) values[match[1] ?? "all"] = number;
  }
  return Object.keys(values).length ? values : null;
}

function common(record: Record<string, string>, syncedAt: Date) {
  return {
    date: record.Date as string,
    campaignId: safeId(record.CampaignId),
    campaignName: text(record.CampaignName),
    adGroupId: safeId(record.AdGroupId),
    adGroupName: text(record.AdGroupName),
    adId: text(record.AdId),
    criterionId: text(record.CriterionId),
    criterion: text(record.Criterion),
    criterionType: text(record.CriterionType),
    matchType: text(record.MatchType),
    targetingCategory: text(record.TargetingCategory),
    incomeGrade: text(record.IncomeGrade),
    placement: text(record.Placement),
    impressions: int(record.Impressions) ?? 0,
    clicks: int(record.Clicks) ?? 0,
    cost: money(record.Cost),
    bounces: int(record.Bounces),
    conversions: goalValues(record, "Conversions"),
    revenue: goalValues(record, "Revenue"),
    data: record,
    syncedAt,
  };
}

export function statsRow(record: Record<string, string>, syncedAt: Date) {
  return {
    ...common(record, syncedAt),
    campaignType: text(record.CampaignType),
    adFormat: text(record.AdFormat),
    age: text(record.Age),
    gender: text(record.Gender),
    device: text(record.Device),
    mobilePlatform: text(record.MobilePlatform),
    carrierType: text(record.CarrierType),
    locationId: safeId(record.LocationOfPresenceId),
    locationName: text(record.LocationOfPresenceName),
    targetingLocationId: safeId(record.TargetingLocationId),
    targetingLocationName: text(record.TargetingLocationName),
    adNetworkType: text(record.AdNetworkType),
    externalNetworkName: text(record.ExternalNetworkName),
    slot: text(record.Slot),
    sessions: int(record.Sessions),
  };
}

export function searchQueryRow(record: Record<string, string>, syncedAt: Date) {
  return {
    ...common(record, syncedAt),
    query: text(record.Query),
    matchedKeyword: text(record.MatchedKeyword),
  };
}

export interface DirectReportResult {
  rows: number;
  goals: number;
}

/**
 * Перезаливает статистику Директа за дни `range`: удаляет старые строки и
 * пишет новые в одной транзакции. Директ дописывает конверсии задним числом,
 * поэтому окно в пару недель каждый день пересчитывается.
 */
export async function syncDirectReport(
  report: DirectReport,
  range: DateRange,
  { waitMs = 240_000 } = {},
): Promise<DirectReportResult> {
  const goals = await reportGoals();
  const tsv = await fetchReport(report, range, goals, waitMs);
  const syncedAt = new Date();
  const records = parseDirectTsv(tsv).filter((record) => record.Date);

  if (report === "stats") {
    const rows = records.map((record) => statsRow(record, syncedAt));
    await db.transaction(async (tx) => {
      await tx
        .delete(directStats)
        .where(
          and(
            gte(directStats.date, range.from),
            lte(directStats.date, range.to),
          ),
        );
      for (const batch of chunks(rows, INSERT_BATCH))
        await tx.insert(directStats).values(batch);
    });
    return { rows: rows.length, goals: goals.length };
  }

  const rows = records.map((record) => searchQueryRow(record, syncedAt));
  await db.transaction(async (tx) => {
    await tx
      .delete(directSearchQueries)
      .where(
        and(
          gte(directSearchQueries.date, range.from),
          lte(directSearchQueries.date, range.to),
        ),
      );
    for (const batch of chunks(rows, INSERT_BATCH))
      await tx.insert(directSearchQueries).values(batch);
  });
  return { rows: rows.length, goals: goals.length };
}
