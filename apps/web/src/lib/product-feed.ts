import type { Product } from "./ozon-types";
import { categories } from "./products";
import { SITE_URL } from "./site-url";

export function xmlEscape(value: string | number): string {
  return (
    String(value)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these characters in seller data
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
}

export function productFeed(products: Product[], now = new Date()) {
  const offers = products
    .filter(
      (p) =>
        p.inStock &&
        Number.isFinite(p.price) &&
        p.price > 0 &&
        ["RUB", "RUR"].includes(p.currency) &&
        p.images.length &&
        categories.some((c) => c.slug === p.category),
    )
    .map((p) => {
      const categoryId = categories.findIndex((c) => c.slug === p.category) + 1;
      const pictures = p.images
        .filter((src) => /^https?:\/\//.test(src) || src.startsWith("/"))
        .slice(0, 10)
        .map(
          (src) =>
            `<picture>${xmlEscape(new URL(src, SITE_URL).href)}</picture>`,
        )
        .join("");
      return `<offer id="${xmlEscape(p.id)}" available="true"><url>${xmlEscape(`${SITE_URL}/catalog/${p.category}/${p.slug}`)}</url><price>${p.price.toFixed(2)}</price><currencyId>RUR</currencyId><categoryId>${categoryId}</categoryId>${pictures}<name>${xmlEscape(p.name)}</name><vendor>Stariva</vendor><description>${xmlEscape(p.description || p.shortDescription || p.name)}</description>${p.material ? `<param name="Материал">${xmlEscape(p.material)}</param>` : ""}${p.dimensions ? `<param name="Размеры">${xmlEscape(p.dimensions)}</param>` : ""}</offer>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?><yml_catalog date="${now.toISOString()}"><shop><name>Stariva</name><company>Stariva</company><url>${SITE_URL}</url><currencies><currency id="RUR" rate="1"/></currencies><categories>${categories.map((c, i) => `<category id="${i + 1}">${xmlEscape(c.name)}</category>`).join("")}</categories><offers>${offers.join("")}</offers></shop></yml_catalog>`;
}
