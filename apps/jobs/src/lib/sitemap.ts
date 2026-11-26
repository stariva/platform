const SITEMAP_TIMEOUT_MS = 30_000;
const MAX_SITEMAP_DEPTH = 2;
const MAX_SITEMAPS = 100;

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

function locsInside(xml: string, element: "url" | "sitemap"): string[] {
  const values: string[] = [];
  const blocks = xml.matchAll(
    new RegExp(
      `<(?:[\\w.-]+:)?${element}\\b[\\s\\S]*?<\\/(?:[\\w.-]+:)?${element}>`,
      "gi",
    ),
  );
  for (const block of blocks) {
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
    console.warn(`[sitemap] пропущено некорректных URL: ${invalid}`);
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
      `[sitemap] читаем первые ${MAX_SITEMAPS} из ${sitemapUrls.length} файлов`,
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

export async function fetchSitemapUrls(
  storefrontUrl: string,
  parentSignal: AbortSignal | undefined,
): Promise<string[]> {
  const rawUrls = await readSitemapUrls(
    `${storefrontUrl}/sitemap.xml`,
    parentSignal,
    0,
  );
  const urls = normalizeUrls(rawUrls);
  if (urls.length === 0) {
    throw new Error("sitemap: нет ни одной корректной страницы");
  }
  return urls;
}
