import { expect, test } from "bun:test";
import { fetchSitemapUrls } from "./sitemap";

test("reads plain and namespaced sitemap urls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://stariva.ru/catalog</loc></url>
        <url><loc>https://stariva.ru/blog/post</loc><image:loc>https://stariva.ru/image.jpg</image:loc></url>
      </urlset>`,
    );
  try {
    await expect(
      fetchSitemapUrls("https://stariva.ru", undefined),
    ).resolves.toEqual([
      "https://stariva.ru/catalog",
      "https://stariva.ru/blog/post",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
