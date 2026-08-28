/**
 * Маппер для трансформации товаров Ozon во внутренние артикулы
 */

import { logger } from "@stariva/config";
import { getNextArticle } from "@/data/ozon-article-template";
import type {
  OzonProductInfo,
  Product,
  ProductCategory,
  ProductSubcategory,
} from "./ozon-types";

/**
 * Маппинг Ozon offer_id на внутренние артикулы
 * Заполняется по мере добавления товаров
 */
export const OZON_TO_ARTICLE_MAP: Record<string, string> = {
  // Примеры маппинга (заполнить реальными данными):
  // "OZON-001": "CLO-DRS-001",
  // "OZON-002": "CLO-DRS-002",
  // "OZON-003": "INT-LMP-001",
};

/**
 * Обратный маппинг: артикул -> Ozon offer_id
 */
export const ARTICLE_TO_OZON_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(OZON_TO_ARTICLE_MAP).map(([ozon, article]) => [article, ozon]),
);

/**
 * Определение категории по названию товара Ozon
 */
export function detectCategoryFromName(name: string): {
  category: ProductCategory;
  subcategory: ProductSubcategory;
} | null {
  const lowerName = name.toLowerCase();

  // ОДЕЖДА
  if (lowerName.includes("платье") || lowerName.includes("dress")) {
    return { category: "clothes", subcategory: "dresses" };
  }
  if (lowerName.includes("топ") || lowerName.includes("top")) {
    return { category: "clothes", subcategory: "tops" };
  }
  if (lowerName.includes("пояс") || lowerName.includes("belt")) {
    return { category: "clothes", subcategory: "belts" };
  }

  // ИНТЕРЬЕР
  if (
    lowerName.includes("абажур") ||
    lowerName.includes("lampshade") ||
    lowerName.includes("светильник")
  ) {
    return { category: "interior", subcategory: "lampshades" };
  }
  if (
    lowerName.includes("типи") ||
    lowerName.includes("tipi") ||
    lowerName.includes("вигвам")
  ) {
    return { category: "interior", subcategory: "tipis" };
  }
  if (
    lowerName.includes("панно") ||
    lowerName.includes("wall panel") ||
    lowerName.includes("настенн")
  ) {
    return { category: "interior", subcategory: "pannos" };
  }
  if (
    lowerName.includes("салфетк") ||
    lowerName.includes("placemat") ||
    lowerName.includes("подставк")
  ) {
    return { category: "interior", subcategory: "placemats" };
  }
  if (
    lowerName.includes("кашпо") ||
    lowerName.includes("planter") ||
    lowerName.includes("plant hanger")
  ) {
    return { category: "interior", subcategory: "planters" };
  }

  // СУМКИ
  if (
    lowerName.includes("шоппер") ||
    lowerName.includes("tote") ||
    lowerName.includes("сумка-шоппер")
  ) {
    return { category: "bags", subcategory: "totes" };
  }
  if (
    lowerName.includes("через плечо") ||
    lowerName.includes("crossbody") ||
    lowerName.includes("кросс-боди")
  ) {
    return { category: "bags", subcategory: "crossbody" };
  }
  if (lowerName.includes("корзин") || lowerName.includes("basket")) {
    return { category: "bags", subcategory: "baskets" };
  }

  return null;
}

/**
 * Определение категории по Ozon category_id
 * (Нужно заполнить реальными ID категорий Ozon)
 */
export function detectCategoryFromOzonId(categoryId: number): {
  category: ProductCategory;
  subcategory: ProductSubcategory;
} | null {
  // Примеры маппинга (заполнить реальными ID):
  const categoryMap: Record<
    number,
    { category: ProductCategory; subcategory: ProductSubcategory }
  > = {
    // 17028922: { category: "clothes", subcategory: "dresses" },
    // 17029016: { category: "interior", subcategory: "lampshades" },
  };

  return categoryMap[categoryId] || null;
}

/**
 * Трансформация товара Ozon во внутренний формат Product
 */
export function transformOzonToProduct(
  ozonProduct: OzonProductInfo,
  existingArticles: string[] = [],
): Product | null {
  // Попытка получить существующий артикул
  let article = OZON_TO_ARTICLE_MAP[ozonProduct.offer_id];

  // Определение категории
  let categoryInfo = detectCategoryFromOzonId(ozonProduct.category_id);
  if (!categoryInfo) {
    categoryInfo = detectCategoryFromName(ozonProduct.name);
  }

  if (!categoryInfo) {
    logger.warn("ozon.article.category_undetected", { name: ozonProduct.name });
    return null;
  }

  // Генерация нового артикула, если не существует
  if (!article) {
    article = getNextArticle(categoryInfo.category, categoryInfo.subcategory, [
      ...existingArticles,
      ...Object.values(OZON_TO_ARTICLE_MAP),
    ]);
    logger.debug("ozon.article.generated", {
      article,
      offerId: ozonProduct.offer_id,
    });
  }

  // Создание slug из артикула
  const slug = article.toLowerCase().replace(/-/g, "-");

  // Парсинг цены
  const price = Number.parseFloat(ozonProduct.price) || 0;
  const oldPrice = ozonProduct.old_price
    ? Number.parseFloat(ozonProduct.old_price)
    : undefined;

  // Извлечение материала из описания (примерная логика)
  const material = extractMaterial(ozonProduct.description) || "100% хлопок";

  // Извлечение размеров (если есть в описании)
  const dimensions = extractDimensions(ozonProduct.description);
  const sizes = extractSizes(ozonProduct.description);
  const color = extractColor(ozonProduct.description);

  return {
    id: article,
    slug,
    name: ozonProduct.name,
    description: ozonProduct.description,
    shortDescription: generateShortDescription(ozonProduct.description),
    price,
    oldPrice,
    currency: ozonProduct.currency_code || "RUB",
    images:
      ozonProduct.images.length > 0
        ? ozonProduct.images
        : [ozonProduct.primary_image],
    category: categoryInfo.category,
    subcategory: categoryInfo.subcategory,
    ozonId: ozonProduct.id,
    ozonUrl: `https://www.ozon.ru/product/${ozonProduct.id}`,
    inStock: ozonProduct.stocks.present > 0,
    material,
    dimensions,
    careInstructions: extractCareInstructions(ozonProduct.description),
    color,
    sizes,
    featured: false,
  };
}

/**
 * Массовая трансформация товаров Ozon
 */
export function transformOzonProducts(
  ozonProducts: OzonProductInfo[],
): Product[] {
  const existingArticles: string[] = [];
  const products: Product[] = [];

  for (const ozonProduct of ozonProducts) {
    const product = transformOzonToProduct(ozonProduct, existingArticles);
    if (product) {
      products.push(product);
      existingArticles.push(product.id);
    }
  }

  return products;
}

/**
 * Вспомогательные функции для извлечения данных из описания
 */

function extractMaterial(description: string): string | null {
  const materialPatterns = [
    /материал[:\s]+([^.\n]+)/i,
    /состав[:\s]+([^.\n]+)/i,
    /(\d+%\s*хлопок)/i,
    /(хлопковый шнур \d+мм)/i,
  ];

  for (const pattern of materialPatterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractDimensions(description: string): string | undefined {
  const dimensionPatterns = [
    /размер[ы]?[:\s]+([^.\n]+)/i,
    /габариты[:\s]+([^.\n]+)/i,
    /(\d+\s*[×x]\s*\d+\s*[×x]?\s*\d*\s*см)/i,
    /(Ø\s*\d+\s*см)/i,
  ];

  for (const pattern of dimensionPatterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractSizes(description: string): string[] | undefined {
  const sizeMatch = description.match(
    /размер[ы]?[:\s]+(XS|S|M|L|XL|XXL|One Size)/gi,
  );
  if (sizeMatch) {
    return [...new Set(sizeMatch.map((s) => s.trim().toUpperCase()))];
  }
  return undefined;
}

function extractColor(description: string): string | undefined {
  const colorPatterns = [
    /цвет[:\s]+([^.\n]+)/i,
    /(белый|бежевый|натуральный|черный|серый|коричневый)/i,
  ];

  for (const pattern of colorPatterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractCareInstructions(description: string): string | undefined {
  const careMatch = description.match(/уход[:\s]+([^.\n]+)/i);
  return careMatch?.[1] ? careMatch[1].trim() : undefined;
}

function generateShortDescription(description: string): string {
  // Берем первое предложение или первые 150 символов
  const firstSentence = description.split(/[.!?]/)[0] ?? description;
  if (firstSentence.length <= 150) {
    return firstSentence.trim();
  }
  return `${description.substring(0, 147).trim()}...`;
}

/**
 * Экспорт маппинга для сохранения
 */
export function exportArticleMapping(
  products: Product[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const product of products) {
    if (product.ozonId) {
      // Предполагаем, что offer_id хранится где-то или используем ozonId
      mapping[`OZON-${product.ozonId}`] = product.id;
    }
  }
  return mapping;
}
