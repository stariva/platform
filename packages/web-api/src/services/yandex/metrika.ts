import { logger } from "@stariva/config";
import { db } from "@stariva/db";
import { metrikaGoals, metrikaHits, metrikaVisits } from "@stariva/db/schema";
import { z } from "zod";
import { env } from "../../env";
import {
  chunks,
  type DateRange,
  excludedColumns,
  moscowDateTime,
  responseDetail,
  sleep,
} from "./common";
import { parseLogsTsv } from "./tsv";

const API_URL = "https://api-metrika.yandex.net/management/v1/counter";
const INSERT_BATCH = 500;

export function isMetrikaConfigured(): boolean {
  return !!env.YANDEX_METRIKA_TOKEN;
}

/** Logs API ещё готовит выгрузку: следующий прогон заберёт тот же запрос. */
export class MetrikaLogsPendingError extends Error {
  constructor(readonly requestId: number) {
    super(`metrika_logs_pending_${requestId}`);
  }
}

/**
 * Модели атрибуции, по которым выгружаем источники визита: первый переход
 * браузера, последний и последний значимый (как в отчётах Метрики).
 */
const ATTRIBUTIONS = ["first", "last", "lastsign"] as const;
const ATTRIBUTED_FIELDS = [
  "TrafficSource",
  "AdvEngine",
  "ReferalSource",
  "SearchEngineRoot",
  "SearchEngine",
  "SocialNetwork",
  "SocialNetworkProfile",
  "RecommendationSystem",
  "Messenger",
  "DirectClickOrder",
  "DirectClickOrderName",
  "DirectBannerGroup",
  "ClickBannerGroupName",
  "DirectClickBanner",
  "DirectClickBannerName",
  "DirectPhraseOrCond",
  "DirectPlatformType",
  "DirectPlatform",
  "DirectConditionType",
  "UTMSource",
  "UTMMedium",
  "UTMCampaign",
  "UTMContent",
  "UTMTerm",
];

/**
 * Все поля визита, кроме того, чего на сайте нет: звонков, Openstat,
 * GCLID, промо-баннеров и показов товаров в списках.
 */
export const VISIT_FIELDS = [
  "visitID",
  "counterID",
  "watchIDs",
  "date",
  "dateTime",
  "isNewUser",
  "startURL",
  "endURL",
  "pageViews",
  "visitDuration",
  "bounce",
  "ipAddress",
  "regionCountry",
  "regionCity",
  "regionCountryID",
  "regionCityID",
  "clientID",
  "counterUserIDHash",
  "goalsID",
  "goalsSerialNumber",
  "goalsDateTime",
  "goalsPrice",
  "goalsOrder",
  "goalsCurrency",
  "referer",
  "from",
  "browserLanguage",
  "browserCountry",
  "clientTimeZone",
  "deviceCategory",
  "mobilePhone",
  "mobilePhoneModel",
  "operatingSystemRoot",
  "operatingSystem",
  "browser",
  "browserMajorVersion",
  "browserEngine",
  "cookieEnabled",
  "javascriptEnabled",
  "screenFormat",
  "screenColors",
  "screenOrientationName",
  "screenWidth",
  "screenHeight",
  "physicalScreenWidth",
  "physicalScreenHeight",
  "windowClientWidth",
  "windowClientHeight",
  "purchaseID",
  "purchaseDateTime",
  "purchaseRevenue",
  "purchaseCurrency",
  "purchaseCoupon",
  "purchaseProductQuantity",
  "productID",
  "productName",
  "productCategory",
  "productPrice",
  "productQuantity",
  "productEventType",
  "productEventTime",
  "purchasedProductPurchaseID",
  "purchasedProductID",
  "purchasedProductName",
  "purchasedProductPrice",
  "purchasedProductQuantity",
  "parsedParamsKey1",
  "parsedParamsKey2",
  "parsedParamsKey3",
  "parsedParamsKey4",
  "parsedParamsKey5",
  ...ATTRIBUTIONS.flatMap((model) =>
    ATTRIBUTED_FIELDS.map((field) => `${model}${field}`),
  ),
].map((field) => `ym:s:${field}`);

/** Поля просмотров и событий: что смотрели, какие цели и параметры. */
export const HIT_FIELDS = [
  "watchID",
  "pageViewID",
  "visitID",
  "counterID",
  "clientID",
  "counterUserIDHash",
  "date",
  "dateTime",
  "title",
  "URL",
  "referer",
  "goalsID",
  "UTMSource",
  "UTMMedium",
  "UTMCampaign",
  "UTMContent",
  "UTMTerm",
  "from",
  "lastTrafficSource",
  "lastAdvEngine",
  "lastSearchEngine",
  "lastSocialNetwork",
  "messenger",
  "recommendationSystem",
  "deviceCategory",
  "operatingSystem",
  "browser",
  "regionCountry",
  "regionCity",
  "ipAddress",
  "isPageView",
  "link",
  "download",
  "notBounce",
  "artificial",
  "httpError",
  "purchaseID",
  "purchaseRevenue",
  "productID",
  "productName",
  "productEventType",
  "ecommerce",
  "params",
  "parsedParamsKey1",
  "parsedParamsKey2",
  "parsedParamsKey3",
  "shareService",
].map((field) => `ym:pv:${field}`);

export type LogSource = "visits" | "hits";

const logRequestSchema = z.object({
  request_id: z.number(),
  source: z.string(),
  date1: z.string(),
  date2: z.string(),
  fields: z.array(z.string()),
  status: z.string(),
  parts: z
    .array(z.object({ part_number: z.number(), size: z.number() }))
    .optional(),
});
type LogRequest = z.infer<typeof logRequestSchema>;

async function metrikaFetch(path: string, init: RequestInit = {}) {
  const token = env.YANDEX_METRIKA_TOKEN;
  if (!token) throw new Error("metrika_not_configured");
  const res = await fetch(
    `${API_URL}/${env.YANDEX_METRIKA_COUNTER_ID}${path}`,
    {
      ...init,
      headers: { Authorization: `OAuth ${token}`, ...init.headers },
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) {
    throw new Error(
      `metrika_request_failed_${res.status}: ${await responseDetail(res)}`,
    );
  }
  return res;
}

async function metrikaJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await metrikaFetch(path, init);
  return schema.parse(await res.json());
}

const goalsSchema = z.object({
  goals: z.array(
    z.looseObject({ id: z.number(), name: z.string(), type: z.string() }),
  ),
});

/** Цели счётчика с условиями: по ним расшифровываются goal_ids. */
export async function syncMetrikaGoals(): Promise<{ goals: number }> {
  const { goals } = await metrikaJson("/goals", goalsSchema);
  const syncedAt = new Date();
  if (goals.length) {
    await db
      .insert(metrikaGoals)
      .values(
        goals.map((goal) => ({
          id: goal.id,
          name: goal.name,
          type: goal.type,
          data: goal,
          syncedAt,
        })),
      )
      .onConflictDoUpdate({
        target: metrikaGoals.id,
        set: excludedColumns(metrikaGoals, "id"),
      });
  }
  return { goals: goals.length };
}

function query(source: LogSource, range: DateRange) {
  return new URLSearchParams({
    date1: range.from,
    date2: range.to,
    source,
    fields: (source === "visits" ? VISIT_FIELDS : HIT_FIELDS).join(","),
  });
}

/** Наш ещё живой запрос с теми же днями и полями: его не создаём заново. */
function sameRequest(request: LogRequest, source: LogSource, range: DateRange) {
  const fields = source === "visits" ? VISIT_FIELDS : HIT_FIELDS;
  return (
    request.source === source &&
    request.date1 === range.from &&
    request.date2 === range.to &&
    request.fields.length === fields.length &&
    fields.every((field) => request.fields.includes(field)) &&
    ["created", "processed", "awaiting_retry"].includes(request.status)
  );
}

async function findOrCreateRequest(
  source: LogSource,
  range: DateRange,
): Promise<LogRequest> {
  const { requests } = await metrikaJson(
    "/logrequests",
    z.object({ requests: z.array(logRequestSchema) }),
  );
  const existing = requests.find((request) =>
    sameRequest(request, source, range),
  );
  if (existing) return existing;

  const params = query(source, range);
  const { log_request_evaluation: evaluation } = await metrikaJson(
    `/logrequests/evaluate?${params}`,
    z.object({
      log_request_evaluation: z.object({
        possible: z.boolean(),
        max_possible_day_quantity: z.number().optional(),
      }),
    }),
  );
  if (!evaluation.possible) {
    throw new Error(
      `metrika_logs_too_large: не больше ${evaluation.max_possible_day_quantity ?? "?"} дн. за раз`,
    );
  }
  const { log_request } = await metrikaJson(
    `/logrequests?${params}`,
    z.object({ log_request: logRequestSchema }),
    { method: "POST" },
  );
  return log_request;
}

const str = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;
const int = (value: unknown) => {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};
/** UInt64-идентификаторы — строками; «0» в Logs API значит «нет». */
const id = (value: unknown) => {
  const text = str(value);
  return text && text !== "0" ? text : null;
};
const numericId = (value: unknown) => {
  const number = int(value);
  return number && Number.isSafeInteger(number) ? number : null;
};
const flag = (value: unknown) => (value === undefined ? null : value === "1");
const numbers = (value: unknown) =>
  Array.isArray(value)
    ? value.map(Number).filter((number) => Number.isSafeInteger(number))
    : null;
const strings = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : null;

export function visitRow(record: Record<string, unknown>, syncedAt: Date) {
  const visitId = id(record.visitID);
  const startedAt = moscowDateTime(record.dateTime);
  if (!visitId || !startedAt) return null;
  return {
    visitId,
    clientId: id(record.clientID),
    startedAt,
    isNewUser: flag(record.isNewUser),
    startUrl: str(record.startURL),
    endUrl: str(record.endURL),
    pageViews: int(record.pageViews),
    duration: int(record.visitDuration),
    bounce: flag(record.bounce),
    trafficSource: str(record.lastsignTrafficSource),
    firstTrafficSource: str(record.firstTrafficSource),
    utmSource: str(record.lastsignUTMSource),
    utmMedium: str(record.lastsignUTMMedium),
    utmCampaign: str(record.lastsignUTMCampaign),
    directCampaignId: numericId(record.lastsignDirectClickOrder),
    directAdGroupId: numericId(record.lastsignDirectBannerGroup),
    directAdId: id(record.lastsignDirectClickBanner),
    directPhrase: str(record.lastsignDirectPhraseOrCond),
    directConditionType: str(record.lastsignDirectConditionType),
    directPlatformType: str(record.lastsignDirectPlatformType),
    directPlatform: str(record.lastsignDirectPlatform),
    country: str(record.regionCountry),
    city: str(record.regionCity),
    deviceCategory: str(record.deviceCategory),
    operatingSystem: str(record.operatingSystem),
    browser: str(record.browser),
    goalIds: numbers(record.goalsID),
    purchaseIds: strings(record.purchaseID),
    data: record,
    syncedAt,
  };
}

export function hitRow(record: Record<string, unknown>, syncedAt: Date) {
  const watchId = id(record.watchID);
  const at = moscowDateTime(record.dateTime);
  if (!watchId || !at) return null;
  return {
    watchId,
    visitId: id(record.visitID),
    clientId: id(record.clientID),
    at,
    url: str(record.URL),
    title: str(record.title),
    referer: str(record.referer),
    isPageView: flag(record.isPageView),
    goalIds: numbers(record.goalsID),
    data: record,
    syncedAt,
  };
}

async function saveRecords(
  source: LogSource,
  records: Array<Record<string, unknown>>,
) {
  const syncedAt = new Date();
  if (source === "visits") {
    const rows = records
      .map((record) => visitRow(record, syncedAt))
      .filter((row) => row !== null);
    for (const batch of chunks(rows, INSERT_BATCH)) {
      await db
        .insert(metrikaVisits)
        .values(batch)
        .onConflictDoUpdate({
          target: metrikaVisits.visitId,
          set: excludedColumns(metrikaVisits, "visit_id"),
        });
    }
    return rows.length;
  }
  const rows = records
    .map((record) => hitRow(record, syncedAt))
    .filter((row) => row !== null);
  for (const batch of chunks(rows, INSERT_BATCH)) {
    await db
      .insert(metrikaHits)
      .values(batch)
      .onConflictDoUpdate({
        target: metrikaHits.watchId,
        set: excludedColumns(metrikaHits, "watch_id"),
      });
  }
  return rows.length;
}

export interface MetrikaLogsResult {
  rows: number;
  requestId: number;
}

/**
 * Выгружает визиты или события за дни `range` и записывает их в базу
 * (повтор перезаписывает те же строки). Logs API готовит выгрузку
 * асинхронно: ждём до `waitMs`, иначе MetrikaLogsPendingError, и повтор
 * подхватит тот же запрос. Скачанный запрос удаляем — он занимает квоту
 * счётчика.
 */
export async function syncMetrikaLogs(
  source: LogSource,
  range: DateRange,
  { waitMs = 240_000, pollMs = 10_000 } = {},
): Promise<MetrikaLogsResult> {
  let request = await findOrCreateRequest(source, range);
  const deadline = Date.now() + waitMs;
  while (request.status !== "processed") {
    if (!["created", "awaiting_retry"].includes(request.status)) {
      throw new Error(
        `metrika_logs_${request.status}: запрос ${request.request_id}`,
      );
    }
    if (Date.now() >= deadline)
      throw new MetrikaLogsPendingError(request.request_id);
    await sleep(pollMs);
    ({ log_request: request } = await metrikaJson(
      `/logrequest/${request.request_id}`,
      z.object({ log_request: logRequestSchema }),
    ));
  }

  let rows = 0;
  for (const part of request.parts ?? []) {
    const res = await metrikaFetch(
      `/logrequest/${request.request_id}/part/${part.part_number}/download`,
    );
    rows += await saveRecords(source, parseLogsTsv(await res.text()));
  }
  await metrikaFetch(`/logrequest/${request.request_id}/clean`, {
    method: "POST",
  }).catch((error: unknown) => {
    // Не очистили — не страшно: Метрика сама удалит запрос через несколько дней
    logger.warn("metrika.logs.clean_failed", {
      requestId: request.request_id,
      error,
    });
  });
  return { rows, requestId: request.request_id };
}
