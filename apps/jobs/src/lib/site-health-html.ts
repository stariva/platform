import { createHash } from "node:crypto";
import type { SiteHealthFinding } from "@stariva/web-api/contract";
import { DomUtils, parseDocument } from "htmlparser2";

export interface ParsedImage {
  url: string;
  altPresent: boolean;
}

export interface ParsedSiteHealthHtml {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  links: string[];
  images: ParsedImage[];
  jsonLdScripts: string[];
}

export interface HtmlAudit {
  titleKey?: string;
  descriptionKey?: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  links: string[];
  images: string[];
  missingAltImages: number;
  findings: SiteHealthFinding[];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function metadataKey(value: string | null) {
  return value
    ? createHash("sha256")
        .update(collapseWhitespace(value).toLowerCase())
        .digest("hex")
    : undefined;
}
export function limitText(value: string | null, max: number): string | null {
  const cleaned = value?.replace(/\0/g, "") ?? null;
  return cleaned && cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

export function absoluteUrl(
  value: string | undefined,
  base: string,
): string | null {
  const raw = value?.trim();
  if (!raw || raw.startsWith("#")) return null;
  if (/^(?:javascript|data|mailto|tel):/i.test(raw)) return null;
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    const normalized = url.toString();
    return normalized.length <= 2000 ? normalized : null;
  } catch {
    return null;
  }
}

export function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

function absoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function textOf(element: unknown): string {
  return collapseWhitespace(
    DomUtils.textContent(element as Parameters<typeof DomUtils.textContent>[0]),
  );
}

export function parseSiteHealthHtml(
  html: string,
  pageUrl: string,
): ParsedSiteHealthHtml {
  const document = parseDocument(html);
  const elements = DomUtils.findAll(() => true, document.children);
  const links: string[] = [];
  const images: ParsedImage[] = [];
  const jsonLdScripts: string[] = [];
  let title: string | null = null;
  let metaDescription: string | null = null;
  let canonical: string | null = null;
  let robots: string | null = null;
  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let ogImage: string | null = null;
  let h1Count = 0;

  const base = elements.find(
    (el) => el.name === "base" && el.attribs.href !== undefined,
  );
  const resourceBase = absoluteUrl(base?.attribs.href, pageUrl) ?? pageUrl;
  for (const element of elements) {
    if (element.name === "title" && title == null) {
      title = textOf(element) || null;
      continue;
    }
    if (element.name === "h1") {
      h1Count++;
      continue;
    }
    if (element.name === "meta") {
      const key = (
        element.attribs.property ??
        element.attribs.name ??
        ""
      ).toLowerCase();
      const content = collapseWhitespace(element.attribs.content ?? "");
      if (!content) continue;
      if (key === "description" && metaDescription == null)
        metaDescription = content;
      if (key === "robots") robots = robots ? `${robots}, ${content}` : content;
      if (key === "og:title" && ogTitle == null) ogTitle = content;
      if (key === "og:description" && ogDescription == null)
        ogDescription = content;
      if (key === "og:image" && ogImage == null) ogImage = content;
      continue;
    }
    if (element.name === "link") {
      const rel = (element.attribs.rel ?? "").toLowerCase().split(/\s+/);
      if (rel.includes("canonical") && canonical == null) {
        canonical = element.attribs.href?.trim() || null;
      }
      continue;
    }
    if (element.name === "a") {
      const href = absoluteUrl(element.attribs.href, resourceBase);
      if (href) links.push(href);
      continue;
    }
    if (element.name === "img") {
      const src = absoluteUrl(element.attribs.src, resourceBase);
      if (src) {
        images.push({
          url: src,
          altPresent: Object.hasOwn(element.attribs, "alt"),
        });
      }
      continue;
    }
    if (
      element.name === "script" &&
      (element.attribs.type ?? "").toLowerCase().trim() ===
        "application/ld+json"
    ) {
      const json = DomUtils.textContent(
        element as Parameters<typeof DomUtils.textContent>[0],
      ).trim();
      if (json) jsonLdScripts.push(json);
    }
  }

  return {
    title,
    metaDescription,
    canonical,
    robots,
    h1Count,
    ogTitle,
    ogDescription,
    ogImage,
    links: unique(links),
    images,
    jsonLdScripts,
  };
}

export function addFinding(
  findings: SiteHealthFinding[],
  severity: SiteHealthFinding["severity"],
  code: string,
  message: string,
  target: string | null = null,
  details: SiteHealthFinding["details"] = null,
) {
  if (
    findings.some(
      (finding) => finding.code === code && finding.target === target,
    )
  ) {
    return;
  }
  findings.push({ severity, code, message, target, details });
}

function comparableUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    if (url.pathname.length > 1)
      url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaEntities(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(schemaEntities);
  if (!isRecord(value)) return [];
  const graph = Array.isArray(value["@graph"])
    ? value["@graph"].flatMap(schemaEntities)
    : [];
  return [value, ...graph];
}

function schemaTypeIs(entity: Record<string, unknown>, type: string): boolean {
  const value = entity["@type"];
  const expected = type.toLowerCase();
  if (typeof value === "string") return value.toLowerCase() === expected;
  if (Array.isArray(value)) {
    return value.some(
      (item) => typeof item === "string" && item.toLowerCase() === expected,
    );
  }
  return false;
}

function productPath(url: string): boolean {
  try {
    return /^\/catalog\/[^/]+\/[^/]+\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function validateJsonLd(
  scripts: string[],
  finalUrl: string,
  findings: SiteHealthFinding[],
) {
  const entities: Record<string, unknown>[] = [];
  let invalid = 0;
  for (const script of scripts) {
    try {
      entities.push(...schemaEntities(JSON.parse(script)));
    } catch {
      invalid++;
    }
  }
  if (invalid > 0) {
    addFinding(
      findings,
      "warning",
      "jsonld_invalid",
      "JSON-LD не парсится как корректный JSON",
      null,
      { invalid },
    );
  }

  if (!productPath(finalUrl)) return;
  const product = entities.find((entity) => schemaTypeIs(entity, "Product"));
  if (!product) {
    addFinding(
      findings,
      "warning",
      "product_schema_missing",
      "На странице товара нет schema.org Product",
    );
  } else {
    const missing: string[] = [];
    if (!product.name) missing.push("name");
    if (!product.image) missing.push("image");
    const rawOffers = product.offers;
    const offers = Array.isArray(rawOffers)
      ? rawOffers.filter(isRecord)
      : isRecord(rawOffers)
        ? [rawOffers]
        : [];
    if (offers.length === 0) {
      missing.push("offers");
    } else {
      if (!offers.some((offer) => offer.price != null && offer.price !== ""))
        missing.push("offers.price");
      if (
        !offers.some(
          (offer) => offer.priceCurrency != null && offer.priceCurrency !== "",
        )
      )
        missing.push("offers.priceCurrency");
      if (
        !offers.some(
          (offer) => offer.availability != null && offer.availability !== "",
        )
      )
        missing.push("offers.availability");
    }
    if (missing.length > 0) {
      addFinding(
        findings,
        "warning",
        "product_schema_incomplete",
        "В schema.org Product не хватает обязательных полей",
        null,
        { missing },
      );
    }
  }

  if (!entities.some((entity) => schemaTypeIs(entity, "BreadcrumbList"))) {
    addFinding(
      findings,
      "notice",
      "breadcrumb_schema_missing",
      "На странице товара нет schema.org BreadcrumbList",
    );
  }
}

export function auditSiteHealthHtml(
  finalUrl: string,
  html: string,
  origin: string,
): HtmlAudit {
  const parsed = parseSiteHealthHtml(html, finalUrl);
  const findings: SiteHealthFinding[] = [];
  const links = unique(parsed.links.filter((link) => sameOrigin(link, origin)));
  const imageUrls = unique(parsed.images.map((image) => image.url));
  const missingAlt = unique(
    parsed.images
      .filter((image) => !image.altPresent)
      .map((image) => image.url),
  );

  if (!parsed.title) {
    addFinding(findings, "warning", "title_missing", "На странице нет title");
  } else if (parsed.title.length > 60) {
    addFinding(
      findings,
      "warning",
      "title_length",
      `Неблагоприятная длина title: ${parsed.title.length} символов`,
      null,
      { length: parsed.title.length },
    );
  }

  if (!parsed.metaDescription) {
    addFinding(
      findings,
      "warning",
      "meta_description_missing",
      "На странице нет meta description",
    );
  } else if (parsed.metaDescription.length > 160) {
    addFinding(
      findings,
      "warning",
      "meta_description_length",
      `Meta description длиннее 160 символов: ${parsed.metaDescription.length}`,
      null,
      { length: parsed.metaDescription.length },
    );
  }

  if (parsed.h1Count === 0) {
    addFinding(findings, "warning", "h1_missing", "На странице нет H1");
  } else if (parsed.h1Count > 1) {
    addFinding(
      findings,
      "warning",
      "h1_multiple",
      `На странице несколько H1: ${parsed.h1Count}`,
      null,
      { count: parsed.h1Count },
    );
  }

  if (!parsed.canonical) {
    addFinding(findings, "warning", "canonical_missing", "Не указан canonical");
  } else {
    const canonical = comparableUrl(parsed.canonical, finalUrl);
    const current = comparableUrl(finalUrl, finalUrl);
    if (!canonical || !absoluteHttpUrl(parsed.canonical)) {
      addFinding(
        findings,
        "warning",
        "canonical_invalid",
        "Canonical не является корректным абсолютным HTTP(S) URL",
        limitText(parsed.canonical, 2000),
      );
    } else if (current && canonical !== current) {
      addFinding(
        findings,
        "warning",
        "canonical_mismatch",
        "Canonical не совпадает с конечным адресом страницы",
        limitText(parsed.canonical, 2000),
        { finalUrl },
      );
    }
  }

  if (
    parsed.robots
      ?.toLowerCase()
      .split(/[\s,]+/)
      .some((token) => token === "noindex" || token === "none")
  ) {
    addFinding(
      findings,
      "critical",
      "noindex",
      "Страница из sitemap закрыта от индексации через noindex",
      null,
      { robots: limitText(parsed.robots, 500) },
    );
  }

  if (!parsed.ogTitle) {
    addFinding(findings, "notice", "og_title_missing", "Нет og:title");
  }
  if (!parsed.ogDescription) {
    addFinding(
      findings,
      "notice",
      "og_description_missing",
      "Нет og:description",
    );
  }
  if (!parsed.ogImage) {
    addFinding(findings, "notice", "og_image_missing", "Нет og:image");
  } else if (!absoluteHttpUrl(parsed.ogImage)) {
    addFinding(
      findings,
      "warning",
      "og_image_invalid",
      "og:image не является корректным абсолютным HTTP(S) URL",
      limitText(parsed.ogImage, 2000),
    );
  }

  validateJsonLd(parsed.jsonLdScripts, finalUrl, findings);

  for (const imageUrl of missingAlt.slice(0, 20)) {
    addFinding(
      findings,
      "warning",
      "image_missing_alt",
      "У изображения нет атрибута alt",
      imageUrl,
    );
  }
  if (missingAlt.length > 20) {
    addFinding(
      findings,
      "warning",
      "images_missing_alt_count",
      `У ${missingAlt.length} изображений нет атрибута alt`,
      null,
      { count: missingAlt.length },
    );
  }

  return {
    titleKey: metadataKey(parsed.title),
    descriptionKey: metadataKey(parsed.metaDescription),
    title: limitText(parsed.title, 500),
    metaDescription: limitText(parsed.metaDescription, 2000),
    canonical: limitText(parsed.canonical, 2000),
    robots: limitText(parsed.robots, 500),
    h1Count: parsed.h1Count,
    links,
    images: imageUrls,
    missingAltImages: missingAlt.length,
    findings,
  };
}
