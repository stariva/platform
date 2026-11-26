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
  const brokenImage = "https://cdn.stariva.ru/broken.jpg";
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
    if (init?.method === "GET") {
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
    if (init?.method === "GET") {
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

test("resolves relative resources against the first base and combines robots tags", () => {
  const audit = auditSiteHealthHtml(
    origin,
    htmlDocument(
      '<img src="img"><a href="link">a</a>',
      '<base href="/one/"><base href="/two/"><meta name="robots" content="index"><meta name="robots" content="NONE, noindex">',
    ),
    origin,
  );
  expect(audit.links).toEqual([`${origin}/one/link`]);
  expect(audit.images).toEqual([`${origin}/one/img`]);
  expect(audit.findings.filter((f) => f.code === "noindex")).toHaveLength(1);
});

test("groups full metadata and evaluates full crawler-scoped headers", async () => {
  const results = await scanSiteHealth(
    ["/a", "/b"].map((s) => origin + s),
    {
      origin,
      fetchImpl: async (url) =>
        new Response(
          htmlDocument(
            "",
            `<title>${"t".repeat(500)}${url}</title><meta name="description" content="${"d".repeat(2000)}${url}">`,
          ),
          {
            headers: {
              "content-type": "text/html",
              "x-robots-tag": url.endsWith("/a")
                ? "otherbot: nofollow, noindex"
                : `${"index, ".repeat(100)}none`,
            },
          },
        ),
    },
  );
  for (const result of results) {
    expect(result.title?.length).toBe(500);
    expect(result.metaDescription?.length).toBe(2000);
    expect(
      result.findings.filter((f) => f.code.startsWith("duplicate_")),
    ).toHaveLength(0);
  }
  expect(
    results.map((r) => r.findings.some((f) => f.code === "noindex")),
  ).toEqual([false, true]);
});

test("checks destinations before each page and resource request", async () => {
  const requests: string[] = [];
  await scanSiteHealth([`${origin}/`, "https://other.example/page"], {
    origin,
    fetchImpl: async (url, { method }) => {
      requests.push(`${method} ${url}`);
      if (url === `${origin}/`)
        return new Response(
          '<img src="https://cdn.stariva.ru/test"><a href="/link">link</a>',
          { headers: { "content-type": "text/html" } },
        );
      if (method === "HEAD") return new Response(null, { status: 405 });
      return new Response(null, {
        status: 302,
        headers: { location: "https://other.example/redirect" },
      });
    },
  });
  expect(requests.sort()).toEqual(
    [
      `GET ${origin}/`,
      `GET ${origin}/link`,
      `HEAD ${origin}/link`,
      "GET https://cdn.stariva.ru/test",
      "HEAD https://cdn.stariva.ru/test",
    ].sort(),
  );
});

test("reports oversized HTML with its HTTP status and cancels unused bodies", async () => {
  for (const [status, type, error] of [
    [200, "text/html", "body_too_large"],
    [404, "text/html", "http_404"],
    [200, "image/png", "not_html"],
  ] as const) {
    let cancelled = false;
    const [result] = await scanSiteHealth([origin], {
      origin,
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(512 * 1024));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status, headers: { "content-type": type } },
        ),
    });
    expect(result?.status).toBe(status);
    expect(result?.error).toBe(error);
    expect(cancelled).toBe(true);
  }
});

test("keeps the incomplete resource notice within a full findings array", async () => {
  const links = Array.from(
    { length: 505 },
    (_, i) => `<a href="/link/${i}">a</a>`,
  ).join("");
  const [result] = await scanSiteHealth([origin], {
    origin,
    maxResourceChecks: 504,
    fetchImpl: async (_, init) =>
      init.method === "HEAD"
        ? new Response(null, { status: 404 })
        : new Response(links, { headers: { "content-type": "text/html" } }),
  });
  expect(result?.findings.length).toBe(500);
  expect(result?.findings.at(-1)?.code).toBe("resource_checks_capped");
});
test("returns the page report when the resource time budget expires", async () => {
  const [result] = await scanSiteHealth([origin], {
    origin,
    resourceDeadline: Date.now() + 100,
    fetchImpl: async (_, init) => {
      if (init.method === "GET")
        return new Response('<a href="/slow">slow</a>', {
          headers: { "content-type": "text/html" },
        });
      return new Promise((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        ),
      );
    },
  });
  expect(result?.status).toBe(200);
  expect(result?.brokenLinks).toBe(0);
  expect(result?.findings.at(-1)?.details).toEqual({ total: 1, checked: 0 });
});
