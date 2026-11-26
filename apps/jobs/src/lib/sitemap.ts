import { DomUtils, parseDocument } from "htmlparser2";
import { boundedText, follow, type ScanFetch, scanFetch } from "./scan-http";

const SITEMAP_TIMEOUT_MS = 30_000;
const MAX_SITEMAP_DEPTH = 2;
// Maximum number of immediate child files read from each index.
const MAX_SITEMAPS = 100;

function requestSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

type XmlElement = ReturnType<typeof DomUtils.findAll>[number];
const NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
function namespace(el: XmlElement) {
  const parts = el.name.split(":");
  if (parts.length > 2) return null;
  const declaration = parts.length === 2 ? `xmlns:${parts[0]}` : "xmlns";
  for (let node: XmlElement | null = el; node; ) {
    const uri = node.attribs[declaration];
    if (uri !== undefined) return uri;
    const parent: XmlElement["parent"] = node.parent;
    node = parent && "attribs" in parent ? parent : null;
  }
  return parts.length === 1 ? "" : null;
}
function parseSitemap(xml: string) {
  const root = parseDocument(xml, { xmlMode: true }).children.find(
    (node): node is XmlElement => node.type === "tag",
  );
  const ns = root && namespace(root);
  const sitemapElement = (el: XmlElement, name: string) =>
    (ns === NAMESPACE || ns === "") &&
    namespace(el) === ns &&
    el.name.split(":").at(-1) === name;
  const index = !!root && sitemapElement(root, "sitemapindex");
  const urls: string[] = [];
  if (root && (index || sitemapElement(root, "urlset"))) {
    for (const child of root.children) {
      if (
        child.type !== "tag" ||
        !sitemapElement(child, index ? "sitemap" : "url")
      )
        continue;
      const loc = child.children.find(
        (el) => el.type === "tag" && sitemapElement(el, "loc"),
      );
      if (loc) {
        const value = DomUtils.textContent(loc).trim();
        if (value) urls.push(value);
      }
    }
  }
  return { index, urls };
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
    console.warn(`[sitemap] пропущено некорректных URL: ${invalid}`);
  }
  return urls;
}

async function readSitemapUrls(
  url: string,
  parentSignal: AbortSignal | undefined,
  depth: number,
  origin: string,
  fetchImpl: ScanFetch,
): Promise<string[]> {
  const res = await follow(url, origin, fetchImpl, {
    method: "GET",
    redirect: "manual",
    headers: {},
    signal: requestSignal(parentSignal, SITEMAP_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`sitemap: HTTP ${res.status}`);
  }
  const { index, urls } = parseSitemap(
    await boundedText(res, 50 * 1024 * 1024),
  );
  if (!index) return urls;
  if (depth >= MAX_SITEMAP_DEPTH) {
    throw new Error("sitemap: слишком глубокая вложенность индекса");
  }
  const sitemapUrls = normalizeUrls(urls);
  if (sitemapUrls.length === 0) {
    throw new Error("sitemap: индекс без корректных ссылок");
  }
  if (sitemapUrls.length > MAX_SITEMAPS) {
    console.warn(
      `[sitemap] читаем первые ${MAX_SITEMAPS} из ${sitemapUrls.length} файлов`,
    );
  }
  const groups = await Promise.all(
    sitemapUrls
      .slice(0, MAX_SITEMAPS)
      .map((sitemapUrl) =>
        readSitemapUrls(sitemapUrl, parentSignal, depth + 1, origin, fetchImpl),
      ),
  );
  return groups.flat();
}

export async function fetchSitemapUrls(
  storefrontUrl: string,
  parentSignal: AbortSignal | undefined,
  fetchImpl: ScanFetch = scanFetch,
): Promise<string[]> {
  const rawUrls = await readSitemapUrls(
    `${storefrontUrl}/sitemap.xml`,
    parentSignal,
    0,
    storefrontUrl,
    fetchImpl,
  );
  const urls = normalizeUrls(rawUrls);
  if (urls.length === 0) {
    throw new Error("sitemap: нет ни одной корректной страницы");
  }
  return urls;
}
