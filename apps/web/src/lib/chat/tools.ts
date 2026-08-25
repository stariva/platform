// ─── Инструменты (tools) AI-консультанта Stariva ────────────────────────────
// Набор серверных инструментов для интерактивной консультации в чате:
// поиск готовых изделий, расчёт индивидуального заказа, подбор мастер-классов,
// поиск статей и выдача контактов. Все execute-функции возвращают компактные
// структурированные данные, которые красиво рендерятся карточками в виджете.

import { tool } from "ai";
import { z } from "zod";
import { blogPosts } from "@/lib/blog";
import {
  COLORS,
  COMPLEXITIES,
  calculatePrice,
  formatRub,
  PRODUCT_TYPES,
  SIZES,
} from "@/lib/custom-order/pricing";
import { getProducts } from "@/lib/ozon-service";
import {
  categoryLabels,
  levelLabels,
  type WorkshopCategory,
  type WorkshopLevel,
  workshops,
} from "@/lib/workshops-data";

// ─── Типы выходных данных (используются и в UI виджета) ─────────────────────

export interface ProductCard {
  slug: string;
  name: string;
  price: number;
  priceFormatted: string;
  oldPriceFormatted?: string;
  image?: string;
  category: string;
  categoryLabel: string;
  url: string;
  inStock: boolean;
  shortDescription?: string;
}

export interface WorkshopCard {
  slug: string;
  title: string;
  subtitle: string;
  level: string;
  category: string;
  price: number;
  priceFormatted: string;
  duration: string;
  lessonsCount: number;
  image?: string;
  url: string;
}

export interface ArticleCard {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image?: string;
  url: string;
  readTime: string;
}

export interface EstimateResult {
  productLabel: string;
  sizeLabel: string;
  colorLabel: string;
  complexityLabel: string;
  min: number;
  max: number;
  minFormatted: string;
  maxFormatted: string;
  rangeFormatted: string;
  productionDays: string;
}

// ─── Вспомогательное ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  clothes: "Одежда",
  bags: "Сумки",
  interior: "Декор интерьера",
};

function productUrl(category: string, slug: string): string {
  return `/catalog/${category}/${slug}`;
}

/** Очень простой нечёткий матч по русскому тексту. */
function matches(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .some((w) => h.includes(w));
}

// ─── Определения инструментов ───────────────────────────────────────────────

export const chatTools = {
  // Поиск готовых изделий из каталога (товары Ozon).
  searchProducts: tool({
    description:
      "Найти готовые изделия из каталога Stariva (продаются на Ozon). Используй, когда клиент хочет что-то купить, спрашивает что есть в наличии, просит подобрать готовое изделие или интересуется ценой конкретного товара. Можно фильтровать по категории, ключевым словам и максимальной цене.",
    inputSchema: z.object({
      query: z
        .string()
        .nullish()
        .describe(
          "Ключевые слова для поиска по названию и описанию, например «абажур», «сумка авоська», «платье»",
        ),
      category: z
        .enum(["clothes", "bags", "interior"])
        .nullish()
        .describe(
          "Категория: clothes — одежда, bags — сумки, interior — декор интерьера",
        ),
      maxPrice: z
        .number()
        .nullish()
        .describe("Максимальная цена в рублях, если клиент назвал бюджет"),
    }),
    execute: async ({
      query,
      category,
      maxPrice,
    }): Promise<{ products: ProductCard[]; total: number; note?: string }> => {
      let products = await getProducts();

      if (products.length === 0) {
        return {
          products: [],
          total: 0,
          note: "Сейчас каталог готовых изделий недоступен. Предложи клиенту написать в Telegram @Olga_Stariva.",
        };
      }

      if (category) products = products.filter((p) => p.category === category);
      if (typeof maxPrice === "number") {
        products = products.filter((p) => p.price <= maxPrice);
      }
      if (query) {
        const filtered = products.filter(
          (p) =>
            matches(p.name, query) ||
            matches(p.shortDescription ?? "", query) ||
            matches(p.description ?? "", query),
        );
        if (filtered.length > 0) products = filtered;
      }

      const total = products.length;
      const cards: ProductCard[] = products.slice(0, 6).map((p) => ({
        slug: p.slug,
        name: p.name,
        price: p.price,
        priceFormatted: formatRub(p.price),
        oldPriceFormatted: p.oldPrice ? formatRub(p.oldPrice) : undefined,
        image: p.images?.[0],
        category: p.category,
        categoryLabel: CATEGORY_LABELS[p.category] ?? p.category,
        url: p.ozonUrl || productUrl(p.category, p.slug),
        inStock: p.inStock,
        shortDescription: p.shortDescription,
      }));

      return { products: cards, total };
    },
  }),

  // Расчёт ориентировочной стоимости индивидуального заказа.
  estimateCustomOrder: tool({
    description:
      "Рассчитать ориентировочную стоимость и срок индивидуального заказа изделия из макраме. Используй, когда клиент хочет заказать изделие на заказ. Недостающие параметры бери по умолчанию (средний размер, натуральный хлопок, стандартная сложность).",
    inputSchema: z.object({
      productType: z
        .enum([
          "lampshade",
          "panel",
          "bag",
          "clothes",
          "tipi",
          "plant-hanger",
          "placemat",
          "other",
        ])
        .describe(
          "Тип: lampshade — абажур, panel — панно, bag — сумка/авоська, clothes — одежда, tipi — вигвам/кресло, plant-hanger — кашпо/подвес, placemat — плейсменты, other — другое",
        ),
      size: z
        .enum(["s", "m", "l", "xl"])
        .default("m")
        .describe(
          "Размер: s — маленький, m — средний, l — большой, xl — очень большой",
        ),
      color: z
        .enum(["natural", "single", "multi"])
        .default("natural")
        .describe(
          "Цвет: natural — натуральный хлопок, single — один цвет, multi — несколько цветов",
        ),
      complexity: z
        .enum(["simple", "standard", "intricate"])
        .default("standard")
        .describe(
          "Сложность: simple — простой узор, standard — стандартный, intricate — сложный плотный узор",
        ),
    }),
    execute: async ({
      productType,
      size,
      color,
      complexity,
    }): Promise<EstimateResult | { error: string }> => {
      const estimate = calculatePrice({ productType, size, color, complexity });
      if (!estimate) return { error: "Не удалось рассчитать стоимость" };

      const productLabel =
        PRODUCT_TYPES.find((p) => p.id === productType)?.label ?? productType;
      const sizeLabel = SIZES.find((s) => s.id === size)?.label ?? size;
      const colorLabel = COLORS.find((c) => c.id === color)?.label ?? color;
      const complexityLabel =
        COMPLEXITIES.find((c) => c.id === complexity)?.label ?? complexity;

      const isBig = size === "l" || size === "xl";
      const isHard = complexity === "intricate";
      const productionDays =
        isBig && isHard
          ? "18–21 день"
          : isBig || isHard
            ? "12–18 дней"
            : "7–14 дней";

      return {
        productLabel,
        sizeLabel,
        colorLabel,
        complexityLabel,
        min: estimate.min,
        max: estimate.max,
        minFormatted: formatRub(estimate.min),
        maxFormatted: formatRub(estimate.max),
        rangeFormatted: `${formatRub(estimate.min)} – ${formatRub(estimate.max)}`,
        productionDays,
      };
    },
  }),

  // Подбор видео-мастер-классов.
  findWorkshops: tool({
    description:
      "Подобрать видео-мастер-классы Stariva (доступ навсегда). Используй при вопросах про обучение, курсы, «хочу научиться плести сам». Можно фильтровать по категории, уровню и цене.",
    inputSchema: z.object({
      category: z
        .enum(["lampshades", "clothing", "interior"])
        .nullish()
        .describe(
          "Категория: lampshades — абажуры, clothing — одежда, interior — декор интерьера",
        ),
      level: z
        .enum(["beginner", "intermediate", "advanced"])
        .nullish()
        .describe(
          "Уровень: beginner — начинающий, intermediate — средний, advanced — продвинутый",
        ),
      maxPrice: z.number().nullish().describe("Максимальная цена в рублях"),
    }),
    execute: async ({
      category,
      level,
      maxPrice,
    }): Promise<{ workshops: WorkshopCard[]; total: number }> => {
      let list = [...workshops];
      if (category) {
        list = list.filter(
          (w) => w.category === (category as WorkshopCategory),
        );
      }
      if (level) {
        list = list.filter((w) => w.level === (level as WorkshopLevel));
      }
      if (typeof maxPrice === "number") {
        list = list.filter((w) => w.price <= maxPrice);
      }

      const cards: WorkshopCard[] = list.slice(0, 6).map((w) => ({
        slug: w.slug,
        title: w.title,
        subtitle: w.subtitle,
        level: levelLabels[w.level],
        category: categoryLabels[w.category],
        price: w.price,
        priceFormatted: formatRub(w.price),
        duration: w.duration,
        lessonsCount: w.lessonsCount,
        image: w.cover,
        url: `/workshops/${w.slug}`,
      }));

      return { workshops: cards, total: list.length };
    },
  }),

  // Поиск статей блога с советами и идеями.
  searchArticles: tool({
    description:
      "Найти статьи из блога Stariva с советами, идеями и руководствами по макраме (уход, история, тренды, дизайн интерьера, выбор материалов). Используй на вопросы «как», «почему», просьбы про идеи и советы.",
    inputSchema: z.object({
      query: z
        .string()
        .nullish()
        .describe(
          "Тема или ключевые слова, например «уход за изделием», «идеи для детской», «тренды»",
        ),
    }),
    execute: async ({
      query,
    }): Promise<{ articles: ArticleCard[]; total: number }> => {
      const filtered = query
        ? blogPosts.filter(
            (post) =>
              matches(post.title, query) ||
              matches(post.excerpt, query) ||
              matches(post.category, query),
          )
        : [];
      const list = filtered.length > 0 ? filtered : blogPosts.slice(0, 3);

      const cards: ArticleCard[] = list.slice(0, 4).map((post) => ({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        image: post.coverImage,
        url: `/blog/${post.slug}`,
        readTime: post.readTime,
      }));

      return { articles: cards, total: filtered.length };
    },
  }),

  // Контакты и режим работы мастерской.
  getContacts: tool({
    description:
      "Получить контакты мастерской Stariva и режим работы. Используй, когда клиент хочет связаться с мастером, оформить индивидуальный заказ или спрашивает телефон/Telegram/часы работы.",
    inputSchema: z.object({}),
    execute: async () => ({
      telegram: "@Olga_Stariva",
      telegramUrl: "https://t.me/Olga_Stariva",
      phone: "+7 977 872 25 46",
      schedule: "Пн–Сб с 10:00 до 20:00, воскресенье — выходной",
      master: "Ольга Карпычева, основатель бренда (с 2018 года)",
      marketplace: "Готовые изделия — на Ozon",
    }),
  }),
} as const;

export type ChatTools = typeof chatTools;
