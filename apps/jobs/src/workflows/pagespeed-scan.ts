import type { PagespeedResult } from "@stariva/web-api/contract";
import { hatchet } from "../client";
import { env } from "../env";
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
const SITEMAP_TIMEOUT_MS = 30_000;
// Индексы sitemap встречаются редко, но не даём им увести прогон вглубь
const MAX_SITEMAP_DEPTH = 2;
const MAX_SITEMAPS = 100;
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

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g,
    (entity, code: string) => {
      if (code === "amp") return "&";
      if (code === "lt") return "<";
      if (code === "gt") return ">";
      if (code === "quot") return '"';
      if (code === "apos") return "'";
      if (!code.startsWith("#")) return entity;

      const hex = code[1]?.toLowerCase() === "x";
      const parsed = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff
        ? String.fromCodePoint(parsed)
        : entity;
    },
  );
}

function xmlText(value: string): string {
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(value.trim());
  return decodeXmlEntities(cdata?.[1] ?? value).trim();
}

/** Значения <loc> только непосредственно внутри <url> или <sitemap>. */
function locsInside(xml: string, element: "url" | "sitemap"): string[] {
  const values: string[] = [];
  const blocks = xml.matchAll(
    new RegExp(
      `<(?:[\\w.-]+:)?${element}\\b[\\s\\S]*?<\\/(?:[\\w.-]+:)?${element}>`,
      "gi",
    ),
  );
  for (const block of blocks) {
    // В <url> могут быть <image:loc> и другие расширения — берём только
    // основной loc страницы (без префикса или с префиксом sitemap)
    const loc =
      /<(?!(?:image|video|news):)(?:[\w.-]+:)?loc>([\s\S]*?)<\/(?!(?:image|video|news):)(?:[\w.-]+:)?loc>/i.exec(
        block[0],
      )?.[1];
    if (!loc) continue;
    const value = xmlText(loc);
    if (value) values.push(value);
  }
  return values;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const normalized = url.toString();
    return normalized.length <= 2000 ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeUrls(rawUrls: string[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  let invalid = 0;
  for (const raw of rawUrls) {
    const url = normalizeUrl(raw);
    if (!url) {
      invalid++;
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  if (invalid > 0) {
    console.warn(`[pagespeed] sitemap: пропущено некорректных URL: ${invalid}`);
  }
  return urls;
}

async function fetchXml(
  url: string,
  parentSignal: AbortSignal | undefined,
): Promise<string> {
  const res = await fetch(url, {
    signal: requestSignal(parentSignal, SITEMAP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
  return res.text();
}

async function readSitemapUrls(
  url: string,
  parentSignal: AbortSignal | undefined,
  depth: number,
): Promise<string[]> {
  const xml = await fetchXml(url, parentSignal);
  if (!/<(?:[\w.-]+:)?sitemapindex[\s>]/i.test(xml)) {
    return locsInside(xml, "url");
  }

  if (depth >= MAX_SITEMAP_DEPTH) {
    throw new Error("sitemap: слишком глубокая вложенность индекса");
  }
  const sitemapUrls = normalizeUrls(locsInside(xml, "sitemap"));
  if (sitemapUrls.length === 0) {
    throw new Error("sitemap: индекс без корректных ссылок");
  }
  if (sitemapUrls.length > MAX_SITEMAPS) {
    console.warn(
      `[pagespeed] sitemap: читаем первые ${MAX_SITEMAPS} из ${sitemapUrls.length} файлов`,
    );
  }
  const groups = await Promise.all(
    sitemapUrls
      .slice(0, MAX_SITEMAPS)
      .map((sitemapUrl) =>
        readSitemapUrls(sitemapUrl, parentSignal, depth + 1),
      ),
  );
  return groups.flat();
}

/** Страницы витрины из sitemap.xml: единственный источник списка. */
async function fetchSitemapUrls(
  parentSignal: AbortSignal | undefined,
): Promise<string[]> {
  const rawUrls = await readSitemapUrls(
    `${env.STOREFRONT_URL}/sitemap.xml`,
    parentSignal,
    0,
  );
  const urls = normalizeUrls(rawUrls);
  if (urls.length === 0) {
    throw new Error("sitemap: нет ни одной корректной страницы");
  }
  return urls;
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
      ? await fetchSitemapUrls(ctx.abortController.signal)
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
