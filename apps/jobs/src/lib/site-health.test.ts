import { expect, test } from "bun:test";
import { scanSiteHealth } from "./site-health";
import { auditSiteHealthHtml } from "./site-health-html";

const origin = "https://stariva.ru";

function htmlDocument(body: string, head = "") {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

function productSchema(offers: Record<string, unknown> = {}) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Пример",
      image: "https://stariva.ru/image.jpg",
      offers,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [],
    },
  ]);
}

test("scans metadata and reports broken links and images", async () => {
  const page = `${origin}/catalog/interior/example`;
  const missingPage = `${origin}/catalog/interior/missing`;
  const brokenImage = "https://cdn.example.test/broken.jpg";
  const head = [
    "<title>Пример хорошего товара</title>",
    '<meta name="description" content="Хорошее описание товара для проверки аудита страницы.">',
    `<link rel="canonical" href="${page}">`,
    '<meta property="og:title" content="Пример">',
    '<meta property="og:description" content="Описание">',
    '<meta property="og:image" content="https://stariva.ru/og.jpg">',
  ].join("");
  const body = [
    "<h1>Пример</h1>",
    `<a href="/catalog/interior/missing">missing</a>`,
    '<a href="https://external.example.test/missing">external</a>',
    `<img src="${brokenImage}">`,
    `<script type="application/ld+json">${productSchema({
      price: "1000",
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
    })}</script>`,
  ].join("");

  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.redirect === "manual") {
      return new Response(htmlDocument(body, head), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-robots-tag": "noindex",
        },
      });
    }
    if (url === missingPage || url === brokenImage) {
      return new Response(null, { status: 404 });
    }
    return new Response(null, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  const [result] = await scanSiteHealth([page], {
    origin,
    fetchImpl: fetchMock as typeof fetch,
    concurrency: 1,
    resourceConcurrency: 1,
  });

  expect(result?.error).toBeNull();
  expect(result?.status).toBe(200);
  expect(result?.title).toBe("Пример хорошего товара");
  expect(result?.internalLinks).toBe(1);
  expect(result?.brokenLinks).toBe(1);
  expect(result?.images).toBe(1);
  expect(result?.brokenImages).toBe(1);
  expect(result?.missingAltImages).toBe(1);
  expect(result?.findings.map((finding) => finding.code)).toEqual(
    expect.arrayContaining([
      "broken_internal_link",
      "broken_image",
      "image_missing_alt",
      "noindex",
    ]),
  );
  expect(result?.findings.map((finding) => finding.code)).not.toContain(
    "product_schema_missing",
  );
});

test("finds duplicate metadata and incomplete product schema", async () => {
  const urls = [
    `${origin}/catalog/interior/one`,
    `${origin}/catalog/interior/two`,
  ];
  const headFor = (url: string) =>
    [
      "<title>Одинаковый title</title>",
      '<meta name="description" content="Одинаковое описание">',
      `<link rel="canonical" href="${url}">`,
      '<meta property="og:title" content="Пример">',
      '<meta property="og:description" content="Описание">',
      '<meta property="og:image" content="https://stariva.ru/og.jpg">',
    ].join("");
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.redirect === "manual") {
      return new Response(
        htmlDocument(
          `<h1>Товар</h1><script type="application/ld+json">${productSchema()}</script>`,
          headFor(url),
        ),
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    return new Response(null, { status: 200 });
  };

  const results = await scanSiteHealth(urls, {
    origin,
    fetchImpl: fetchMock as typeof fetch,
    concurrency: 1,
    resourceConcurrency: 1,
  });

  expect(results).toHaveLength(2);
  for (const result of results) {
    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain("duplicate_title");
    expect(codes).toContain("duplicate_meta_description");
    expect(codes).toContain("product_schema_incomplete");
  }
});

test("reports a sitemap page that returns 404", async () => {
  const page = `${origin}/missing`;
  const fetchMock = async () =>
    new Response("not found", {
      status: 404,
      headers: { "content-type": "text/html" },
    });

  const [result] = await scanSiteHealth([page], {
    origin,
    fetchImpl: fetchMock as typeof fetch,
    concurrency: 1,
    resourceConcurrency: 1,
  });

  expect(result?.error).toBe("http_404");
  expect(result?.findings[0]?.code).toBe("http_error");
  expect(result?.findings[0]?.severity).toBe("critical");
});

test("requires absolute canonical and og:image and counts missing alt once per image", () => {
  const page = `${origin}/catalog/interior/example`;
  const audit = auditSiteHealthHtml(
    page,
    htmlDocument(
      '<h1>Пример</h1><img src="/x.jpg"><img src="/x.jpg">',
      [
        "<title>Пример</title>",
        '<meta name="description" content="Описание">',
        '<link rel="canonical" href="/catalog/interior/example">',
        '<meta property="og:title" content="Пример">',
        '<meta property="og:description" content="Описание">',
        '<meta property="og:image" content="/og.jpg">',
      ].join(""),
    ),
    origin,
  );

  const codes = audit.findings.map((finding) => finding.code);
  expect(codes).toContain("canonical_invalid");
  expect(codes).toContain("og_image_invalid");
  expect(audit.missingAltImages).toBe(1);
});
