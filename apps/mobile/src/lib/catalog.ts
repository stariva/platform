import type { CatalogCourse } from "@stariva/web-api/contract";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { absoluteUrl, api } from "@/lib/api";
import { readJson, writeJson } from "@/lib/storage";

export interface CatalogWorkshop {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  level: string;
  length: string;
  price: string;
  href: string;
  isPreorder: boolean;
}

const categories: Record<CatalogCourse["category"], string> = {
  lampshades: "Абажуры",
  clothing: "Одежда",
  interior: "Декор интерьера",
};
const levels: Record<CatalogCourse["level"], string> = {
  beginner: "Для начинающих",
  intermediate: "Средний уровень",
  advanced: "Для опытных",
};

function toWorkshop(course: CatalogCourse): CatalogWorkshop {
  return {
    id: course.slug,
    title: course.title,
    category: categories[course.category],
    image: absoluteUrl(course.cover),
    description: course.description || course.subtitle,
    level: levels[course.level],
    length: `${course.lessonCount} уроков`,
    price: course.priceKopecks
      ? new Intl.NumberFormat("ru-RU", {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        }).format(course.priceKopecks / 100)
      : "Бесплатно",
    href: `/workshops/${course.slug}`,
    isPreorder: course.isPreorder,
  };
}

/**
 * Каталог — первое, что видит человек. Без сети показываем последнюю удачную
 * копию: пустой экран при входе в метро RuStore считает нерабочим приложением.
 */
const CATALOG_CACHE_KEY = "stariva:catalog-courses";
const catalogCacheSchema = z.array(
  z.object({
    slug: z.string(),
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    cover: z.string(),
    category: z.enum(["lampshades", "clothing", "interior"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    priceKopecks: z.number().int().nonnegative(),
    lessonCount: z.number().int().nonnegative(),
    isPreorder: z.boolean(),
  }),
);

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog-courses"],
    queryFn: async () => {
      try {
        const courses = await api.account.catalogCourses();
        void writeJson(CATALOG_CACHE_KEY, courses);
        return courses.map(toWorkshop);
      } catch (error) {
        if (!navigator.onLine) {
          const cached = await readJson(CATALOG_CACHE_KEY, catalogCacheSchema);
          if (cached) return cached.map(toWorkshop);
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    networkMode: "offlineFirst",
  });
}
