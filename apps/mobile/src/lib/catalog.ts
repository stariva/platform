import type { CatalogCourse } from "@stariva/web-api/contract";
import { useQuery } from "@tanstack/react-query";
import { absoluteUrl, api } from "@/lib/api";

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

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog-courses"],
    queryFn: async () => (await api.account.catalogCourses()).map(toWorkshop),
    staleTime: 5 * 60_000,
  });
}
