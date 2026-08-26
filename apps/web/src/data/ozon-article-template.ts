/**
 * Шаблон артикулов для товаров Ozon
 *
 * Структура артикула: КАТЕГОРИЯ-ПОДКАТЕГОРИЯ-НОМЕР
 * Примеры:
 * - CLO-DRS-001 (Одежда - Платья - 001)
 * - INT-LMP-001 (Интерьер - Абажуры - 001)
 * - BAG-TOT-001 (Сумки - Шопперы - 001)
 */

export type ArticlePrefix = {
  category: string;
  subcategory: string;
  prefix: string;
  description: string;
};

/**
 * Префиксы категорий и подкатегорий
 */
export const ARTICLE_PREFIXES: Record<string, ArticlePrefix[]> = {
  // ОДЕЖДА (Clothes)
  clothes: [
    {
      category: "clothes",
      subcategory: "dresses",
      prefix: "CLO-DRS",
      description: "Платья макраме",
    },
    {
      category: "clothes",
      subcategory: "tops",
      prefix: "CLO-TOP",
      description: "Топы макраме",
    },
    {
      category: "clothes",
      subcategory: "belts",
      prefix: "CLO-BLT",
      description: "Пояса макраме",
    },
  ],

  // ИНТЕРЬЕР (Interior)
  interior: [
    {
      category: "interior",
      subcategory: "lampshades",
      prefix: "INT-LMP",
      description: "Абажуры макраме",
    },
    {
      category: "interior",
      subcategory: "tipis",
      prefix: "INT-TIP",
      description: "Типи для детей",
    },
    {
      category: "interior",
      subcategory: "pannos",
      prefix: "INT-PAN",
      description: "Панно макраме",
    },
    {
      category: "interior",
      subcategory: "placemats",
      prefix: "INT-PLM",
      description: "Салфетки/подставки",
    },
    {
      category: "interior",
      subcategory: "planters",
      prefix: "INT-PLN",
      description: "Кашпо для растений",
    },
  ],

  // СУМКИ (Bags)
  bags: [
    {
      category: "bags",
      subcategory: "totes",
      prefix: "BAG-TOT",
      description: "Сумки-шопперы",
    },
    {
      category: "bags",
      subcategory: "crossbody",
      prefix: "BAG-CRS",
      description: "Сумки через плечо",
    },
    {
      category: "bags",
      subcategory: "baskets",
      prefix: "BAG-BSK",
      description: "Корзины макраме",
    },
  ],
};

/**
 * Примеры артикулов для каждой категории
 */
export const ARTICLE_EXAMPLES = {
  // ОДЕЖДА
  "CLO-DRS-001": {
    name: "Платье макраме бохо белое",
    category: "clothes",
    subcategory: "dresses",
    sizes: ["XS", "S", "M", "L"],
    color: "Белый",
    material: "100% хлопок",
  },
  "CLO-DRS-002": {
    name: "Платье макраме бохо бежевое",
    category: "clothes",
    subcategory: "dresses",
    sizes: ["XS", "S", "M", "L"],
    color: "Бежевый",
    material: "100% хлопок",
  },
  "CLO-TOP-001": {
    name: "Топ макраме летний белый",
    category: "clothes",
    subcategory: "tops",
    sizes: ["XS", "S", "M", "L"],
    color: "Белый",
    material: "100% хлопок",
  },
  "CLO-BLT-001": {
    name: "Пояс макраме с бахромой",
    category: "clothes",
    subcategory: "belts",
    sizes: ["One Size"],
    color: "Натуральный",
    material: "100% хлопок",
  },

  // ИНТЕРЬЕР
  "INT-LMP-001": {
    name: "Абажур макраме купол большой",
    category: "interior",
    subcategory: "lampshades",
    dimensions: "Ø40см × 50см",
    color: "Натуральный",
    material: "Хлопковый шнур 5мм",
  },
  "INT-LMP-002": {
    name: "Абажур макраме цилиндр средний",
    category: "interior",
    subcategory: "lampshades",
    dimensions: "Ø30см × 40см",
    color: "Натуральный",
    material: "Хлопковый шнур 4мм",
  },
  "INT-TIP-001": {
    name: "Типи детское с макраме декором",
    category: "interior",
    subcategory: "tipis",
    dimensions: "120см × 120см × 150см",
    color: "Белый с натуральным",
    material: "Хлопок, деревянные палки",
  },
  "INT-PAN-001": {
    name: "Панно макраме настенное большое",
    category: "interior",
    subcategory: "pannos",
    dimensions: "80см × 100см",
    color: "Натуральный",
    material: "Хлопковый шнур 5мм",
  },
  "INT-PAN-002": {
    name: "Панно макраме круглое",
    category: "interior",
    subcategory: "pannos",
    dimensions: "Ø60см",
    color: "Натуральный",
    material: "Хлопковый шнур 4мм",
  },
  "INT-PLM-001": {
    name: "Набор салфеток макраме (4 шт)",
    category: "interior",
    subcategory: "placemats",
    dimensions: "35см × 45см",
    color: "Натуральный",
    material: "100% хлопок",
  },
  "INT-PLN-001": {
    name: "Кашпо макраме подвесное",
    category: "interior",
    subcategory: "planters",
    dimensions: "Длина 90см, для горшка Ø15-20см",
    color: "Натуральный",
    material: "Хлопковый шнур 4мм",
  },

  // СУМКИ
  "BAG-TOT-001": {
    name: "Сумка-шоппер макраме большая",
    category: "bags",
    subcategory: "totes",
    dimensions: "40см × 35см × 15см",
    color: "Натуральный",
    material: "Хлопковый шнур 5мм",
  },
  "BAG-CRS-001": {
    name: "Сумка через плечо макраме",
    category: "bags",
    subcategory: "crossbody",
    dimensions: "25см × 20см × 8см",
    color: "Бежевый",
    material: "Хлопковый шнур 4мм",
  },
  "BAG-BSK-001": {
    name: "Корзина макраме для хранения",
    category: "bags",
    subcategory: "baskets",
    dimensions: "Ø30см × 35см",
    color: "Натуральный",
    material: "Хлопковый шнур 6мм",
  },
};

/**
 * Генератор артикула
 */
export function generateArticle(
  category: string,
  subcategory: string,
  number: number,
): string {
  const categoryPrefixes = ARTICLE_PREFIXES[category];
  if (!categoryPrefixes) {
    throw new Error(`Unknown category: ${category}`);
  }

  const subcategoryPrefix = categoryPrefixes.find(
    (p) => p.subcategory === subcategory,
  );
  if (!subcategoryPrefix) {
    throw new Error(
      `Unknown subcategory: ${subcategory} for category: ${category}`,
    );
  }

  const paddedNumber = String(number).padStart(3, "0");
  return `${subcategoryPrefix.prefix}-${paddedNumber}`;
}

/**
 * Парсер артикула
 */
export function parseArticle(article: string): {
  category: string;
  subcategory: string;
  number: number;
} | null {
  const match = article.match(/^([A-Z]{3})-([A-Z]{3})-(\d{3})$/);
  if (!match) {
    return null;
  }

  const [, categoryCode, subcategoryCode, numberStr] = match;
  if (!categoryCode || !subcategoryCode || !numberStr) {
    return null;
  }
  const prefix = `${categoryCode}-${subcategoryCode}`;

  for (const [category, prefixes] of Object.entries(ARTICLE_PREFIXES)) {
    const found = prefixes.find((p) => p.prefix === prefix);
    if (found) {
      return {
        category,
        subcategory: found.subcategory,
        number: Number.parseInt(numberStr, 10),
      };
    }
  }

  return null;
}

/**
 * Получить следующий доступный артикул для категории/подкатегории
 */
export function getNextArticle(
  category: string,
  subcategory: string,
  existingArticles: string[],
): string {
  const prefix = ARTICLE_PREFIXES[category]?.find(
    (p) => p.subcategory === subcategory,
  )?.prefix;

  if (!prefix) {
    throw new Error(`Invalid category/subcategory: ${category}/${subcategory}`);
  }

  // Найти все существующие номера для этого префикса
  const existingNumbers = existingArticles
    .filter((article) => article.startsWith(prefix))
    .map((article) => {
      const match = article.match(/-(\d{3})$/);
      return match?.[1] ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((num) => num > 0);

  const maxNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return generateArticle(category, subcategory, maxNumber + 1);
}

/**
 * Валидация артикула
 */
export function isValidArticle(article: string): boolean {
  return parseArticle(article) !== null;
}

/**
 * Получить описание по артикулу
 */
export function getArticleDescription(article: string): string | null {
  const parsed = parseArticle(article);
  if (!parsed) {
    return null;
  }

  const prefix = ARTICLE_PREFIXES[parsed.category]?.find(
    (p) => p.subcategory === parsed.subcategory,
  );

  return prefix?.description || null;
}
