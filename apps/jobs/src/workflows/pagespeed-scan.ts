import type { PagespeedResult } from "@stariva/web-api/contract";
import { hatchet } from "../client";
import { env } from "../env";
import { fetchSitemapUrls } from "../lib/sitemap";
import { webApi, withRetry } from "../lib/web-api";

/**
 * Раз в день прогоняет страницы из sitemap.xml витрины через Google
 * PageSpeed Insights и складывает оценки на сайт (jobs.pagespeed.report),
 * админка показывает их в разделе «Скорость страниц». Мобильная и
 * десктопная стратегии — независимые задания: падение одной не мешает
 * другой. Результаты уходят пачками по ходу сканирования: сбой в середине
 * не теряет собранное, а повторный прогон в тот же день перезаписывает
 * строки — повторы безопасны.
 *
 * Нужен PAGESPEED_API_KEY в окружении воркера; без него задание тихо
 * заканчивается ничем — крон каждый день не должен сыпать ошибками.
 */
export const pagespeedScanWorkflow = hatchet.workflow({
  name: "pagespeed-scan",
  // 05:40 по Москве: до утреннего трафика, после ночных выгрузок аналитики
  on: { cron: "40 2 * * *" },
});

const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;
// Сколько страниц сканируется одновременно; квота ключа — сотни запросов в
// минуту, но каждый прогон идёт 10–30 секунд, так что упираемся не в квоту
const CONCURRENCY = 3;
const REPORT_BATCH = 10;
// Сканирование одной страницы на медленном сервере Lighthouse до минуты
const SCAN_TIMEOUT_MS = 90_000;
// Страниц в sitemap сотня-две: полный прогон стратегии — десятки минут
const EXECUTION_TIMEOUT = "3600s";

type Strategy = PagespeedResult["strategy"];

interface LighthouseAudit {
  numericValue?: number;
}

interface LighthouseResponse {
  error?: { message?: string };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null } | undefined> | null;
    audits?: Record<string, LighthouseAudit | undefined>;
  };
}

function emptyResult(
  url: string,
  strategy: Strategy,
  scannedAt: string,
): PagespeedResult {
  return {
    url,
    strategy,
    scannedAt,
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null,
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    totalBlockingTime: null,
    cumulativeLayoutShift: null,
    speedIndex: null,
    error: null,
  };
}

function requestSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function psiUrl(url: string, strategy: Strategy, key: string): string {
  const params = new URLSearchParams({ url, strategy, key });
  for (const category of PSI_CATEGORIES) params.append("category", category);
  return `${PSI_API}?${params}`;
}

function categoryScore(
  json: LighthouseResponse,
  category: string,
): number | null {
  const score = json.lighthouseResult?.categories?.[category]?.score;
  return score == null ? null : Math.round(score * 100);
}

function auditValue(json: LighthouseResponse, audit: string): number | null {
  const value = json.lighthouseResult?.audits?.[audit]?.numericValue;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 1000) / 1000
    : null;
}

function psiError(status: number): string {
  if (status >= 200 && status < 300) return "psi_no_result";
  if (status === 400) return "psi_bad_request";
  if (status === 401 || status === 403) return "psi_key_rejected";
  if (status === 429) return "psi_quota";
  if (status >= 500) return "psi_unavailable";
  return `psi_http_${status}`;
}

function networkError(error: unknown): string {
  if (error instanceof SyntaxError) return "psi_invalid_response";
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "psi_timeout";
  }
  return "psi_network_error";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Один прогон PSI с повторами на квоту и сбои API. Постоянная ошибка не
 * валит прогон: возвращается строка с error, в админке видно пробел.
 */
async function scanPage(
  url: string,
  strategy: Strategy,
  key: string,
  parentSignal: AbortSignal | undefined,
  runAt: string,
): Promise<PagespeedResult> {
  const result = emptyResult(url, strategy, runAt);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      parentSignal?.throwIfAborted();
      const res = await fetch(psiUrl(url, strategy, key), {
        signal: requestSignal(parentSignal, SCAN_TIMEOUT_MS),
      });
      // Квота или разовый сбой API — ждём и повторяем
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(20_000 * attempt, parentSignal);
        continue;
      }
      const json = (await res.json()) as LighthouseResponse;
      if (!res.ok || !json.lighthouseResult) {
        result.error = psiError(res.status);
        return result;
      }
      result.performance = categoryScore(json, "performance");
      result.accessibility = categoryScore(json, "accessibility");
      result.bestPractices = categoryScore(json, "best-practices");
      result.seo = categoryScore(json, "seo");
      result.firstContentfulPaint = auditValue(json, "first-contentful-paint");
      result.largestContentfulPaint = auditValue(
        json,
        "largest-contentful-paint",
      );
      result.totalBlockingTime = auditValue(json, "total-blocking-time");
      result.cumulativeLayoutShift = auditValue(
        json,
        "cumulative-layout-shift",
      );
      result.speedIndex = auditValue(json, "speed-index");
      if (result.performance == null) {
        result.error = "lighthouse_runtime_error";
      }
      return result;
    } catch (error) {
      if (parentSignal?.aborted) throw error;
      if (attempt >= 3) {
        result.error = networkError(error);
        return result;
      }
      await sleep(10_000 * attempt, parentSignal);
    }
  }
  return result;
}

/**
 * Сканирует все страницы sitemap в одной стратегии с ограниченным
 * параллелизмом и отправляет результаты пачками по мере готовности.
 */
async function scanStrategy(
  strategy: Strategy,
  urls: string[],
  signal?: AbortSignal,
) {
  const key = env.PAGESPEED_API_KEY;
  if (!key) {
    return { configured: false, scanned: 0, failed: 0 };
  }

  const runAt = new Date().toISOString();
  let scanned = 0;
  let failed = 0;
  let batch: PagespeedResult[] = [];
  let next = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const results = batch;
    batch = [];
    await withRetry("pagespeed.report", (context) =>
      webApi.jobs.pagespeed.report({ results }, { context }),
    );
  };

  const worker = async () => {
    while (next < urls.length) {
      signal?.throwIfAborted();
      const url = urls[next++];
      if (!url) break;
      const result = await scanPage(url, strategy, key, signal, runAt);
      result.error ? failed++ : scanned++;
      batch.push(result);
      if (batch.length >= REPORT_BATCH) await flush();
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  await flush();

  return { configured: true, scanned, failed };
}

const taskOptions = {
  retries: 1,
  backoff: { factor: 2, maxSeconds: 600 },
  executionTimeout: EXECUTION_TIMEOUT,
} as const;

// Список страниц читается один раз и используется обеими стратегиями
const sitemap = pagespeedScanWorkflow.task({
  name: "fetch-sitemap",
  retries: 2,
  backoff: { factor: 2, maxSeconds: 300 },
  executionTimeout: "120s",
  fn: async (_input, ctx) => ({
    urls: env.PAGESPEED_API_KEY
      ? await fetchSitemapUrls(env.STOREFRONT_URL, ctx.abortController.signal)
      : [],
  }),
});

pagespeedScanWorkflow.task({
  name: "scan-mobile",
  parents: [sitemap],
  ...taskOptions,
  fn: async (_input, ctx) => {
    const { urls } = await ctx.parentOutput(sitemap);
    return scanStrategy("mobile", urls, ctx.abortController.signal);
  },
});

pagespeedScanWorkflow.task({
  name: "scan-desktop",
  parents: [sitemap],
  ...taskOptions,
  fn: async (_input, ctx) => {
    const { urls } = await ctx.parentOutput(sitemap);
    return scanStrategy("desktop", urls, ctx.abortController.signal);
  },
});
