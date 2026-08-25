import slugifyLib from "@sindresorhus/slugify";
import type { Product } from "../ozon-types";
import { mapOfferIdToCategory } from "./category-mapper";

// Локальный интерфейс для ответа v3 API (отличается от полного OzonProductInfo)
export interface OzonProductInfoV3 {
  id: number;
  offer_id: string;
  name: string;
  description: string;
  images: string[];
  primary_image: string | string[];
  price: string;
  old_price: string;
  currency_code: string;
  sku: number;
  stocks?: {
    stocks?: { present: number; reserved: number }[];
  };
}

export type ExtractedAttributes = {
  material?: string;
  careInstructions?: string;
  color?: string;
  sizes?: string[];
  description?: string;
};

export function slugify(text: string): string {
  return slugifyLib(text, {
    lowercase: true,
    decamelize: false,
    customReplacements: [
      // Дополнительные замены для кириллицы, если нужно
    ],
  });
}

export function extractAttributes(
  attrs: {
    id?: number;
    attribute_id?: number;
    values?: { value?: string }[];
  }[],
): ExtractedAttributes {
  if (!attrs?.length) return {};

  // API v4 возвращает поле "id", не "attribute_id"
  const DESCRIPTION_ID = 4191;
  const COLOR_ID = 10097;

  const result: ExtractedAttributes = {};

  for (const attr of attrs) {
    const attrId = attr.id ?? (attr as { attribute_id?: number }).attribute_id;
    const vals = (attr.values ?? [])
      .map((v) => (v.value ?? "").trim())
      .filter(Boolean);
    if (!vals.length) continue;

    // Описание
    if (attrId === DESCRIPTION_ID) {
      result.description = vals[0];
      continue;
    }

    // Цвет
    if (attrId === COLOR_ID) {
      result.color = vals.join(", ");
    }
  }

  // Fallback: ищем по ключевым словам для материала, ухода, цвета
  for (const attr of attrs) {
    const vals = (attr.values ?? [])
      .map((v) => (v.value ?? "").trim())
      .filter(Boolean);
    if (!vals.length) continue;

    const materialKeywords =
      /хлопок|полиэфир|шнур|лён|шерсть|акрил|cotton|polyester/i;
    if (!result.material && vals.some((v) => materialKeywords.test(v))) {
      result.material = vals.find((v) => materialKeywords.test(v));
    }

    const careKeywords = /стирк|уход|чистк|wash|care/i;
    if (!result.careInstructions && vals.some((v) => careKeywords.test(v))) {
      result.careInstructions = vals.find((v) => careKeywords.test(v));
    }

    if (!result.color) {
      const colorKeywords =
        /бежев|молочн|белый|чёрн|черн|коричнев|серый|айвори|экрю|капучино|натуральн|слоновая/i;
      if (vals.some((v) => colorKeywords.test(v))) {
        result.color = vals.filter((v) => colorKeywords.test(v)).join(", ");
      }
    }

    const sizePattern = /^(XS|S|M|L|XL|XXL|\d{2})$/i;
    if (
      !result.sizes &&
      vals.length > 0 &&
      vals.every((v) => sizePattern.test(v))
    ) {
      result.sizes = vals;
    }
  }

  return result;
}

export function transformOzonProduct(
  ozonProduct: OzonProductInfoV3,
  attrs?: ExtractedAttributes,
): Product {
  const { category, subcategory } = mapOfferIdToCategory(
    ozonProduct.offer_id || "",
  );
  const price = parseFloat(ozonProduct.price) || 0;
  const oldPrice = parseFloat(ozonProduct.old_price) || undefined;

  const stocksList: Array<{ present: number; reserved: number }> =
    ozonProduct.stocks?.stocks || [];
  const totalPresent = stocksList.reduce((sum, s) => sum + (s.present || 0), 0);
  const inStock = totalPresent > 0;

  // primary_image в v3 — массив строк; ставим первой, затем остальные из images[]
  const primaryImage = Array.isArray(ozonProduct.primary_image)
    ? ozonProduct.primary_image[0]
    : ozonProduct.primary_image;

  const galleryImages: string[] = ozonProduct.images ?? [];

  let images: string[];
  if (primaryImage) {
    const rest = galleryImages.filter((img) => img !== primaryImage);
    images = [primaryImage, ...rest];
  } else if (galleryImages.length > 0) {
    images = galleryImages;
  } else {
    images = ["/images/catalog/placeholder.jpg"];
  }

  const name = ozonProduct.name || "Без названия";
  const rawDescription = attrs?.description || ozonProduct.description || "";

  const hasHtml = /<[a-z][\s\S]*>/i.test(rawDescription);
  const description = rawDescription
    ? hasHtml
      ? rawDescription
      : rawDescription
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("")
    : `<p>${name}</p>`;

  // Чистый текст для карточки (без HTML тегов)
  const plainDescription = rawDescription
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<li>/gi, " • ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const shortDescription = plainDescription
    ? plainDescription.slice(0, 200).replace(/\s+\S*$/, "") +
      (plainDescription.length > 200 ? "…" : "")
    : name;

  // Создаём уникальный slug из названия товара для SEO
  // Приоритет: название товара > артикул > ID
  let uniqueSlug: string;

  if (name && name !== "Без названия") {
    // Используем название товара для SEO-friendly URL
    const baseSlug = slugify(name);
    // Добавляем короткий ID для уникальности (последние 4 цифры)
    const shortId = String(ozonProduct.id).slice(-4);
    uniqueSlug = `${baseSlug}-${shortId}`;
  } else if (ozonProduct.offer_id) {
    // Fallback: артикул
    uniqueSlug = slugify(ozonProduct.offer_id);
  } else {
    // Последний fallback: product + ID
    uniqueSlug = `product-${ozonProduct.id}`;
  }

  return {
    id: `ozon-${ozonProduct.id}`,
    slug: uniqueSlug,
    name,
    description,
    shortDescription,
    price,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
    currency: ozonProduct.currency_code || "RUB",
    images,
    category,
    subcategory,
    ozonId: ozonProduct.id,
    ozonUrl: `https://www.ozon.ru/product/${ozonProduct.sku || ozonProduct.id}`,
    inStock,
    material: attrs?.material || "100% хлопок",
    careInstructions: attrs?.careInstructions,
    color: attrs?.color,
    sizes: attrs?.sizes,
    featured: false,
  };
}
