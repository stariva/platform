import { expect, test } from "bun:test";
import { fetchSitemapUrls } from "./sitemap";

test("reads plain and namespaced sitemap urls", async () => {
  const fetchImpl = async () =>
    new Response(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://stariva.ru/catalog</loc></url>
        <url><loc>https://stariva.ru/blog/post</loc><image:loc>https://stariva.ru/image.jpg</image:loc></url>
      </urlset>`,
    );

  await expect(
    fetchSitemapUrls("https://stariva.ru", undefined, fetchImpl),
  ).resolves.toEqual([
    "https://stariva.ru/catalog",
    "https://stariva.ru/blog/post",
  ]);
});

test("reads only direct sitemap loc children, preserving CDATA", async () => {
  const xml = `<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:e="urn:extension">
 <!-- <s:url><s:loc>https://stariva.ru/comment</s:loc></s:url> -->
 <s:url><e:loc>https://stariva.ru/ext</e:loc><e:wrapper><s:loc>https://stariva.ru/nested</s:loc></e:wrapper><s:loc><![CDATA[ https://stariva.ru/?a&amp;b ]]></s:loc></s:url>
 <s:url><s:loc>https://stariva.ru/?a&amp;b</s:loc></s:url></s:urlset>`;
  expect(
    await fetchSitemapUrls(
      "https://stariva.ru",
      undefined,
      async () => new Response(xml),
    ),
  ).toEqual(["https://stariva.ru/?a&amp;b", "https://stariva.ru/?a&b"]);
});

test("follows allowed sitemap redirects and checks a nested destination before fetching it", async () => {
  const requests: string[] = [];
  const origin = "https://stariva.ru";
  await expect(
    fetchSitemapUrls(origin, undefined, async (url) => {
      requests.push(url);
      if (url.endsWith("/sitemap.xml"))
        return new Response(null, {
          status: 301,
          headers: { location: "/index.xml" },
        });
      return new Response(
        "<sitemapindex><sitemap><loc>https://elsewhere.example/nested.xml</loc></sitemap></sitemapindex>",
      );
    }),
  ).rejects.toThrow("blocked_destination");
  expect(requests).toEqual([`${origin}/sitemap.xml`, `${origin}/index.xml`]);
});
