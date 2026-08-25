/**
 * Примеры использования системы артикулов Ozon
 * Этот файл содержит готовые примеры для быстрого старта
 */

import {
  detectCategoryFromName,
  transformOzonProducts,
  transformOzonToProduct,
} from "@/lib/ozon-article-mapper";
import type { OzonProductInfo } from "@/lib/ozon-types";
import {
  ARTICLE_EXAMPLES,
  generateArticle,
  getArticleDescription,
  getNextArticle,
  isValidArticle,
  parseArticle,
} from "./ozon-article-template";

// ============================================================================
// ПРИМЕР 1: Генерация артикулов для новых товаров
// ============================================================================

export function example1_generateArticles() {
  console.log("=== Пример 1: Генерация артикулов ===\n");

  // Создать артикул для нового платья
  const dressArticle = generateArticle("clothes", "dresses", 1);
  console.log(`Платье #1: ${dressArticle}`); // CLO-DRS-001

  // Создать артикул для абажура
  const lampArticle = generateArticle("interior", "lampshades", 1);
  console.log(`Абажур #1: ${lampArticle}`); // INT-LMP-001

  // Создать артикул для сумки
  const bagArticle = generateArticle("bags", "totes", 1);
  console.log(`Сумка #1: ${bagArticle}`); // BAG-TOT-001

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 2: Парсинг существующих артикулов
// ============================================================================

export function example2_parseArticles() {
  console.log("=== Пример 2: Парсинг артикулов ===\n");

  const articles = ["CLO-DRS-001", "INT-LMP-005", "BAG-TOT-010"];

  for (const article of articles) {
    const parsed = parseArticle(article);
    if (parsed) {
      console.log(`${article}:`);
      console.log(`  Категория: ${parsed.category}`);
      console.log(`  Подкатегория: ${parsed.subcategory}`);
      console.log(`  Номер: ${parsed.number}`);
      console.log(`  Описание: ${getArticleDescription(article)}`);
    }
  }

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 3: Получение следующего доступного артикула
// ============================================================================

export function example3_getNextArticle() {
  console.log("=== Пример 3: Следующий доступный артикул ===\n");

  // Существующие артикулы платьев
  const existingDresses = ["CLO-DRS-001", "CLO-DRS-002", "CLO-DRS-005"];

  const nextDress = getNextArticle("clothes", "dresses", existingDresses);
  console.log(`Существующие платья: ${existingDresses.join(", ")}`);
  console.log(`Следующий артикул: ${nextDress}`); // CLO-DRS-006

  // Существующие артикулы абажуров
  const existingLamps = ["INT-LMP-001", "INT-LMP-002"];

  const nextLamp = getNextArticle("interior", "lampshades", existingLamps);
  console.log(`\nСуществующие абажуры: ${existingLamps.join(", ")}`);
  console.log(`Следующий артикул: ${nextLamp}`); // INT-LMP-003

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 4: Валидация артикулов
// ============================================================================

export function example4_validateArticles() {
  console.log("=== Пример 4: Валидация артикулов ===\n");

  const testArticles = [
    "CLO-DRS-001", // валидный
    "INT-LMP-999", // валидный
    "INVALID-123", // невалидный формат
    "CLO-DRS-1", // невалидный (не 3 цифры)
    "XXX-YYY-001", // невалидный (несуществующая категория)
  ];

  for (const article of testArticles) {
    const isValid = isValidArticle(article);
    console.log(`${article}: ${isValid ? "✓ валидный" : "✗ невалидный"}`);
  }

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 5: Определение категории по названию товара
// ============================================================================

export function example5_detectCategory() {
  console.log("=== Пример 5: Определение категории ===\n");

  const productNames = [
    "Платье макраме бохо белое",
    "Абажур макраме купол большой",
    "Сумка-шоппер макраме натуральная",
    "Топ макраме летний",
    "Панно макраме настенное",
    "Кашпо для растений подвесное",
  ];

  for (const name of productNames) {
    const category = detectCategoryFromName(name);
    if (category) {
      console.log(`"${name}"`);
      console.log(`  → ${category.category} / ${category.subcategory}\n`);
    }
  }

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 6: Трансформация товара Ozon в Product
// ============================================================================

export function example6_transformOzonProduct() {
  console.log("=== Пример 6: Трансформация товара Ozon ===\n");

  // Пример товара из Ozon API
  const ozonProduct: OzonProductInfo = {
    id: 12345,
    offer_id: "OZON-DRESS-001",
    name: "Платье макраме бохо белое",
    barcode: "1234567890123",
    category_id: 17028922,
    description:
      "Красивое платье макраме в стиле бохо. Материал: 100% хлопок. Размеры: XS, S, M, L. Цвет: белый. Уход: ручная стирка в холодной воде.",
    images: [
      "/images/catalog/dress-boho-1.jpg",
      "/images/catalog/dress-boho-2.jpg",
    ],
    primary_image: "/images/catalog/dress-boho-1.jpg",
    price: "4500",
    old_price: "5500",
    currency_code: "RUB",
    sku: 123456789,
    fbo_sku: 123456789,
    fbs_sku: 0,
    sources: [
      {
        is_enabled: true,
        sku: 123456789,
        source: "fbo",
      },
    ],
    stocks: {
      coming: 0,
      present: 5,
      reserved: 1,
    },
    status: {
      state: "processed",
      state_failed: "",
      moderate_status: "approved",
      decline_reasons: [],
      validation_state: "success",
      state_name: "Processed",
      state_description: "Product is ready for sale",
      is_failed: false,
      is_created: true,
      state_tooltip: "",
    },
    visible_status: "visible",
    visibility_details: {
      has_price: true,
      has_stock: true,
      active_product: true,
    },
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-20T15:30:00Z",
  };

  const product = transformOzonToProduct(ozonProduct);

  if (product) {
    console.log("Трансформированный товар:");
    console.log(`  Артикул: ${product.id}`);
    console.log(`  Slug: ${product.slug}`);
    console.log(`  Название: ${product.name}`);
    console.log(`  Категория: ${product.category} / ${product.subcategory}`);
    console.log(`  Цена: ${product.price} ${product.currency}`);
    console.log(`  Старая цена: ${product.oldPrice || "нет"}`);
    console.log(`  В наличии: ${product.inStock ? "да" : "нет"}`);
    console.log(`  Материал: ${product.material}`);
    console.log(`  Цвет: ${product.color || "не указан"}`);
    console.log(`  Размеры: ${product.sizes?.join(", ") || "не указаны"}`);
    console.log(`  Ozon ID: ${product.ozonId}`);
    console.log(`  Ozon URL: ${product.ozonUrl}`);
  }

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 7: Массовая трансформация товаров
// ============================================================================

export function example7_transformMultipleProducts() {
  console.log("=== Пример 7: Массовая трансформация ===\n");

  // Пример нескольких товаров из Ozon API
  const ozonProducts: OzonProductInfo[] = [
    {
      id: 12345,
      offer_id: "OZON-DRESS-001",
      name: "Платье макраме бохо белое",
      description: "Красивое платье макраме. Материал: 100% хлопок.",
      price: "4500",
      old_price: "",
      currency_code: "RUB",
      images: ["/images/catalog/dress-boho-1.jpg"],
      primary_image: "/images/catalog/dress-boho-1.jpg",
      stocks: { coming: 0, present: 5, reserved: 1 },
      // ... остальные поля
    } as OzonProductInfo,
    {
      id: 12346,
      offer_id: "OZON-LAMP-001",
      name: "Абажур макраме купол большой",
      description:
        "Абажур макраме для светильника. Размеры: Ø40см × 50см. Материал: хлопковый шнур 5мм.",
      price: "3200",
      old_price: "",
      currency_code: "RUB",
      images: ["/images/catalog/lampshade-dome.jpg"],
      primary_image: "/images/catalog/lampshade-dome.jpg",
      stocks: { coming: 0, present: 3, reserved: 0 },
      // ... остальные поля
    } as OzonProductInfo,
    {
      id: 12347,
      offer_id: "OZON-BAG-001",
      name: "Сумка-шоппер макраме большая",
      description:
        "Вместительная сумка-шоппер. Размеры: 40см × 35см × 15см. Материал: хлопковый шнур 5мм.",
      price: "2800",
      old_price: "3500",
      currency_code: "RUB",
      images: ["/images/catalog/bag-tote.jpg"],
      primary_image: "/images/catalog/bag-tote.jpg",
      stocks: { coming: 0, present: 8, reserved: 2 },
      // ... остальные поля
    } as OzonProductInfo,
  ];

  const products = transformOzonProducts(ozonProducts);

  console.log(`Трансформировано товаров: ${products.length}\n`);

  for (const product of products) {
    console.log(`${product.id} - ${product.name}`);
    console.log(`  Категория: ${product.category}/${product.subcategory}`);
    console.log(`  Цена: ${product.price} ${product.currency}`);
    console.log(`  В наличии: ${product.inStock ? "да" : "нет"}\n`);
  }
}

// ============================================================================
// ПРИМЕР 8: Работа с маппингом Ozon offer_id → Артикул
// ============================================================================

export function example8_articleMapping() {
  console.log("=== Пример 8: Маппинг артикулов ===\n");

  // Добавить маппинг вручную (в реальном коде редактировать ozon-article-mapper.ts)
  const customMapping: Record<string, string> = {
    "OZON-DRESS-001": "CLO-DRS-001",
    "OZON-DRESS-002": "CLO-DRS-002",
    "OZON-LAMP-001": "INT-LMP-001",
    "OZON-BAG-001": "BAG-TOT-001",
  };

  console.log("Маппинг Ozon offer_id → Артикул:");
  for (const [ozonId, article] of Object.entries(customMapping)) {
    console.log(`  ${ozonId} → ${article}`);
  }

  console.log("\n");
}

// ============================================================================
// ПРИМЕР 9: Просмотр всех примеров артикулов
// ============================================================================

export function example9_viewAllExamples() {
  console.log("=== Пример 9: Все примеры артикулов ===\n");

  const categories = {
    Одежда: ["CLO-DRS-001", "CLO-DRS-002", "CLO-TOP-001", "CLO-BLT-001"],
    Интерьер: [
      "INT-LMP-001",
      "INT-LMP-002",
      "INT-TIP-001",
      "INT-PAN-001",
      "INT-PAN-002",
      "INT-PLM-001",
      "INT-PLN-001",
    ],
    Сумки: ["BAG-TOT-001", "BAG-CRS-001", "BAG-BSK-001"],
  };

  for (const [categoryName, articles] of Object.entries(categories)) {
    console.log(`${categoryName}:`);
    for (const article of articles) {
      const example =
        ARTICLE_EXAMPLES[article as keyof typeof ARTICLE_EXAMPLES];
      if (example) {
        console.log(`  ${article}: ${example.name}`);
      }
    }
    console.log("");
  }
}

// ============================================================================
// Запуск всех примеров
// ============================================================================

export function runAllExamples() {
  example1_generateArticles();
  example2_parseArticles();
  example3_getNextArticle();
  example4_validateArticles();
  example5_detectCategory();
  example6_transformOzonProduct();
  example7_transformMultipleProducts();
  example8_articleMapping();
  example9_viewAllExamples();
}

// Для тестирования в консоли браузера или Node.js
if (typeof window !== "undefined") {
  // @ts-expect-error
  window.ozonArticleExamples = {
    example1_generateArticles,
    example2_parseArticles,
    example3_getNextArticle,
    example4_validateArticles,
    example5_detectCategory,
    example6_transformOzonProduct,
    example7_transformMultipleProducts,
    example8_articleMapping,
    example9_viewAllExamples,
    runAllExamples,
  };
}
