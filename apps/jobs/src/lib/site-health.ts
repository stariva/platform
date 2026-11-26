import type { SiteHealthPageResult } from "@stariva/web-api/contract";
import {
  boundedText,
  checkedUrl,
  follow,
  type ScanFetch,
  scanFetch,
} from "./scan-http";
import {
  absoluteUrl,
  addFinding,
  auditSiteHealthHtml,
  limitText,
} from "./site-health-html";

const PAGE_TIMEOUT_MS = 30_000;
const RESOURCE_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 10;
const LARGE_IMAGE_BYTES = 500_000;
const MAX_FINDINGS_PER_PAGE = 500;

export interface SiteHealthScanOptions {
  origin: string;
  scannedAt?: string;
  signal?: AbortSignal;
  fetchImpl?: ScanFetch;
  concurrency?: number;
  resourceConcurrency?: number;
  maxResourceChecks?: number;
  resourceDeadline?: number;
}

interface FetchedPage {
  status: number | null;
  finalUrl: string | null;
  redirectCount: number | null;
  responseTimeMs: number | null;
  contentType: string | null;
  xRobotsTag: string | null;
  html: string | null;
  error: string | null;
}

interface ResourceCheck {
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  error: string | null;
}

interface ScanOneResult {
  titleKey?: string;
  descriptionKey?: string;
  result: SiteHealthPageResult;
  links: string[];
  images: string[];
}

function requestSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function networkError(error: unknown): string {
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "timeout";
  }
  return "network_error";
}

async function cancelBody(response: Pick<Response, "body">) {
  try {
    await response.body?.cancel();
  } catch {}
}

function redirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function fetchPage(
  url: string,
  origin: string,
  signal: AbortSignal | undefined,
  fetchImpl: ScanFetch,
): Promise<FetchedPage> {
  const startedAt = Date.now();
  let current = url;
  const seen = new Set<string>([url]);

  try {
    for (let redirects = 0; ; ) {
      const response = await fetchImpl(checkedUrl(current, origin), {
        method: "GET",
        redirect: "manual",
        signal: requestSignal(signal, PAGE_TIMEOUT_MS),
        headers: { "user-agent": "StarivaSiteHealthBot/1.0" },
      });

      if (!redirectStatus(response.status)) {
        const type = response.headers.get("content-type");
        let html = null;
        let error = null;
        if (
          response.ok &&
          (!type || type.toLowerCase().includes("text/html"))
        ) {
          try {
            html = await boundedText(response, 4 * 1024 * 1024);
          } catch (e) {
            if (!(e instanceof Error) || e.message !== "body_too_large")
              throw e;
            error = e.message;
          }
        } else await cancelBody(response);
        return {
          status: response.status,
          finalUrl: response.url || current,
          redirectCount: redirects,
          responseTimeMs: Date.now() - startedAt,
          contentType: response.headers.get("content-type"),
          xRobotsTag: response.headers.get("x-robots-tag"),
          html,
          error,
        };
      }

      await cancelBody(response);
      redirects++;
      if (redirects > MAX_REDIRECTS) {
        return {
          status: null,
          finalUrl: current,
          redirectCount: redirects,
          responseTimeMs: Date.now() - startedAt,
          contentType: null,
          xRobotsTag: null,
          html: null,
          error: "too_many_redirects",
        };
      }
      const location = response.headers.get("location");
      const next = location ? absoluteUrl(location, current) : null;
      if (!next) {
        return {
          status: response.status,
          finalUrl: current,
          redirectCount: redirects,
          responseTimeMs: Date.now() - startedAt,
          contentType: null,
          xRobotsTag: null,
          html: null,
          error: "invalid_redirect",
        };
      }
      if (seen.has(next)) {
        return {
          status: null,
          finalUrl: next,
          redirectCount: redirects,
          responseTimeMs: Date.now() - startedAt,
          contentType: null,
          xRobotsTag: null,
          html: null,
          error: "redirect_loop",
        };
      }
      seen.add(next);
      current = next;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      status: null,
      finalUrl: current,
      redirectCount: null,
      responseTimeMs: Date.now() - startedAt,
      contentType: null,
      xRobotsTag: null,
      html: null,
      error: networkError(error),
    };
  }
}

function emptyResult(url: string, scannedAt: string): SiteHealthPageResult {
  return {
    url,
    scannedAt,
    status: null,
    finalUrl: null,
    redirectCount: null,
    responseTimeMs: null,
    title: null,
    metaDescription: null,
    canonical: null,
    robots: null,
    h1Count: null,
    internalLinks: null,
    brokenLinks: null,
    images: null,
    brokenImages: null,
    missingAltImages: null,
    error: null,
    findings: [],
  };
}

async function scanOne(
  url: string,
  scannedAt: string,
  origin: string,
  signal: AbortSignal | undefined,
  fetchImpl: ScanFetch,
): Promise<ScanOneResult> {
  const result = emptyResult(url, scannedAt);
  const fetched = await fetchPage(url, origin, signal, fetchImpl);
  result.status = fetched.status;
  result.finalUrl = limitText(fetched.finalUrl, 2000);
  result.redirectCount = fetched.redirectCount;
  result.responseTimeMs = fetched.responseTimeMs;

  if (fetched.error) {
    result.error = fetched.error;
    addFinding(
      result.findings,
      "critical",
      "page_fetch_failed",
      "Страницу не удалось загрузить",
      null,
      { error: fetched.error },
    );
    return { result, links: [], images: [] };
  }

  if ((fetched.redirectCount ?? 0) > 0) {
    addFinding(
      result.findings,
      "warning",
      "sitemap_url_redirects",
      "Адрес из sitemap отвечает редиректом",
      result.finalUrl,
      { redirectCount: fetched.redirectCount },
    );
  }

  if (!fetched.status || fetched.status < 200 || fetched.status >= 300) {
    result.error = fetched.status ? `http_${fetched.status}` : "http_no_status";
    addFinding(
      result.findings,
      "critical",
      "http_error",
      `Страница из sitemap отвечает HTTP ${fetched.status ?? "без статуса"}`,
      null,
      { status: fetched.status },
    );
    return { result, links: [], images: [] };
  }

  const contentType = fetched.contentType?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("text/html")) {
    result.error = "not_html";
    addFinding(
      result.findings,
      "critical",
      "page_not_html",
      "Страница из sitemap отвечает не HTML-документом",
      null,
      { contentType: fetched.contentType },
    );
    return { result, links: [], images: [] };
  }

  if (!fetched.html?.trim()) {
    result.error = "empty_html";
    addFinding(
      result.findings,
      "critical",
      "empty_html",
      "Страница вернула пустой HTML",
    );
    return { result, links: [], images: [] };
  }

  const finalUrl = fetched.finalUrl ?? url;
  const audit = auditSiteHealthHtml(finalUrl, fetched.html, origin);
  const xRobotsTag = limitText(fetched.xRobotsTag, 500);
  result.title = audit.title;
  result.metaDescription = audit.metaDescription;
  result.canonical = audit.canonical;
  result.robots = limitText(
    [audit.robots, xRobotsTag].filter(Boolean).join(", ") || null,
    500,
  );
  result.h1Count = audit.h1Count;
  result.internalLinks = audit.links.length;
  result.brokenLinks = 0;
  result.images = audit.images.length;
  result.brokenImages = 0;
  result.missingAltImages = audit.missingAltImages;
  result.findings.push(...audit.findings);
  if (blocksGenericIndexing(fetched.xRobotsTag)) {
    addFinding(
      result.findings,
      "critical",
      "noindex",
      "Страница из sitemap закрыта от индексации через X-Robots-Tag",
      null,
      { robots: xRobotsTag },
    );
  }

  return {
    result,
    titleKey: audit.titleKey,
    descriptionKey: audit.descriptionKey,
    links: audit.links,
    images: audit.images,
  };
}

// The audit evaluates generic crawlers and our own declared user agent.
function blocksGenericIndexing(header: string | null) {
  let applies = true;
  for (const part of (header ?? "").toLowerCase().split(",")) {
    const match = /^([\w*-]+)\s*:\s*(.*)$/.exec(part.trim());
    if (
      match &&
      [
        "unavailable_after",
        "max-snippet",
        "max-video-preview",
        "max-image-preview",
      ].includes(match[1] ?? "")
    )
      continue;
    if (match)
      applies = match[1] === "starivasitehealthbot" || match[1] === "*";
    if (applies && ["noindex", "none"].includes((match?.[2] ?? part).trim()))
      return true;
  }
  return false;
}
function metadataGroups(
  scans: ScanOneResult[],
  field: "titleKey" | "descriptionKey",
) {
  const byValue = new Map<string, string[]>();
  for (const scan of scans) {
    const key = scan[field];
    if (!key) continue;
    const urls = byValue.get(key) ?? [];
    urls.push(scan.result.url);
    byValue.set(key, urls);
  }
  return new Map([...byValue].filter(([, urls]) => urls.length > 1));
}
function addDuplicateMetadataFindings(scans: ScanOneResult[]) {
  const duplicateTitles = metadataGroups(scans, "titleKey");
  const duplicateDescriptions = metadataGroups(scans, "descriptionKey");
  for (const { result, titleKey, descriptionKey } of scans) {
    const titleUrls = titleKey ? duplicateTitles.get(titleKey) : undefined;
    if (titleUrls) {
      addFinding(
        result.findings,
        "warning",
        "duplicate_title",
        "Title совпадает у нескольких страниц",
        null,
        { urls: titleUrls.slice(0, 20) },
      );
    }

    const descriptionUrls = descriptionKey
      ? duplicateDescriptions.get(descriptionKey)
      : undefined;
    if (descriptionUrls) {
      addFinding(
        result.findings,
        "warning",
        "duplicate_meta_description",
        "Meta description совпадает у нескольких страниц",
        null,
        { urls: descriptionUrls.slice(0, 20) },
      );
    }
  }
}

async function checkResource(
  url: string,
  origin: string,
  allowImages: boolean,
  signal: AbortSignal | undefined,
  fetchImpl: ScanFetch,
): Promise<ResourceCheck> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await follow(
        url,
        origin,
        fetchImpl,
        {
          method,
          redirect: "manual",
          signal: requestSignal(signal, RESOURCE_TIMEOUT_MS),
          headers: { "user-agent": "StarivaSiteHealthBot/1.0" },
        },
        allowImages,
      );
      if (
        method === "HEAD" &&
        (response.status === 405 || response.status === 501)
      ) {
        await cancelBody(response);
        continue;
      }
      await cancelBody(response);
      const length = response.headers.get("content-length");
      const contentLength = length ? Number.parseInt(length, 10) : null;
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        contentLength:
          contentLength != null && Number.isFinite(contentLength)
            ? contentLength
            : null,
        error: null,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (method === "GET") {
        return {
          status: null,
          contentType: null,
          contentLength: null,
          error: networkError(error),
        };
      }
    }
  }
  return {
    status: null,
    contentType: null,
    contentLength: null,
    error: "resource_check_failed",
  };
}

async function checkResources(
  urls: string[],
  origin: string,
  images: Set<string>,
  signal: AbortSignal | undefined,
  fetchImpl: ScanFetch,
  concurrency: number,
  deadline: number | undefined,
): Promise<Map<string, ResourceCheck>> {
  const checks = new Map<string, ResourceCheck>();
  if (deadline !== undefined && deadline <= Date.now()) return checks;
  const budget =
    deadline === undefined
      ? undefined
      : AbortSignal.timeout(Math.max(0, deadline - Date.now()));
  const resourceSignal =
    signal && budget ? AbortSignal.any([signal, budget]) : (signal ?? budget);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      signal?.throwIfAborted();
      if (budget?.aborted) break;
      const url = urls[next++];
      if (!url) break;
      try {
        checks.set(
          url,
          await checkResource(
            url,
            origin,
            images.has(url),
            resourceSignal,
            fetchImpl,
          ),
        );
      } catch (error) {
        signal?.throwIfAborted();
        if (!budget?.aborted) throw error;
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );
  return checks;
}

function capFindings(result: SiteHealthPageResult) {
  if (result.findings.length > MAX_FINDINGS_PER_PAGE) {
    const last = result.findings.at(-1);
    result.findings = result.findings.slice(0, MAX_FINDINGS_PER_PAGE);
    if (last?.code === "resource_checks_capped")
      result.findings[MAX_FINDINGS_PER_PAGE - 1] = last;
  }
}

function collectResources(completed: ScanOneResult[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    order.push(url);
  };
  for (const scan of completed) {
    for (const link of scan.links) push(link);
  }
  for (const scan of completed) {
    for (const image of scan.images) push(image);
  }
  return order;
}

function applyResourceChecks(
  completed: ScanOneResult[],
  checks: Map<string, ResourceCheck>,
  totalResources: number,
  checkedResources: number,
) {
  for (const scan of completed) {
    const result = scan.result;
    let brokenLinks = 0;
    for (const link of scan.links) {
      const check = checks.get(link);
      if (!check) continue;
      if (!check.status || check.status >= 400 || check.error) {
        brokenLinks++;
        addFinding(
          result.findings,
          "critical",
          "broken_internal_link",
          "Внутренняя ссылка возвращает ошибку",
          link,
          { status: check.status, error: check.error },
        );
      }
    }

    let brokenImages = 0;
    for (const image of scan.images) {
      const check = checks.get(image);
      if (!check) continue;
      if (!check.status || check.status >= 400 || check.error) {
        brokenImages++;
        addFinding(
          result.findings,
          "critical",
          "broken_image",
          "Изображение возвращает ошибку",
          image,
          { status: check.status, error: check.error },
        );
        continue;
      }
      if (
        check.contentType &&
        !check.contentType.toLowerCase().startsWith("image/")
      ) {
        addFinding(
          result.findings,
          "warning",
          "image_wrong_content_type",
          "URL изображения отвечает не image/* content-type",
          image,
          { contentType: check.contentType },
        );
      }
      if (
        check.contentLength != null &&
        check.contentLength > LARGE_IMAGE_BYTES
      ) {
        addFinding(
          result.findings,
          "warning",
          "large_image",
          "Изображение весит больше 500 КБ",
          image,
          { bytes: check.contentLength },
        );
      }
    }

    if (result.internalLinks != null) result.brokenLinks = brokenLinks;
    if (result.images != null) result.brokenImages = brokenImages;
    const hasUncheckedResources =
      scan.links.some((link) => !checks.has(link)) ||
      scan.images.some((image) => !checks.has(image));
    if (totalResources > checkedResources && hasUncheckedResources) {
      addFinding(
        result.findings,
        "notice",
        "resource_checks_capped",
        "Не все ссылки и изображения страницы проверены из-за лимита прогона",
        null,
        { total: totalResources, checked: checkedResources },
      );
    }
    capFindings(result);
  }
}

export async function scanSiteHealth(
  urls: string[],
  options: SiteHealthScanOptions,
): Promise<SiteHealthPageResult[]> {
  const fetchImpl = options.fetchImpl ?? scanFetch;
  const scannedAt = options.scannedAt ?? new Date().toISOString();
  const scans: (ScanOneResult | undefined)[] = Array.from({
    length: urls.length,
  });
  let next = 0;

  const worker = async () => {
    while (next < urls.length) {
      options.signal?.throwIfAborted();
      const index = next++;
      const url = urls[index];
      if (!url) break;
      try {
        scans[index] = await scanOne(
          url,
          scannedAt,
          options.origin,
          options.signal,
          fetchImpl,
        );
      } catch (error) {
        if (options.signal?.aborted) throw error;
        console.warn(`[site-health] не удалось сканировать ${url}`, error);
        const result = emptyResult(url, scannedAt);
        result.error = "scanner_error";
        addFinding(
          result.findings,
          "critical",
          "page_scan_failed",
          "Страницу не удалось проверить из-за внутренней ошибки сканера",
        );
        scans[index] = { result, links: [], images: [] };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, options.concurrency ?? 3) }, () =>
      worker(),
    ),
  );

  const completed = scans.filter(
    (scan): scan is ScanOneResult => scan !== undefined,
  );
  const results = completed.map((scan) => scan.result);
  addDuplicateMetadataFindings(completed);

  const resources = collectResources(completed);
  const checkedUrls = resources.slice(0, options.maxResourceChecks ?? 2000);
  const checks = await checkResources(
    checkedUrls,
    options.origin,
    new Set(completed.flatMap((scan) => scan.images)),
    options.signal,
    fetchImpl,
    Math.max(1, options.resourceConcurrency ?? 5),
    options.resourceDeadline,
  );
  applyResourceChecks(completed, checks, resources.length, checks.size);

  return results;
}
