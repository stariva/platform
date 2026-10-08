import { logger } from "@stariva/config";
import { and, asc, db, eq, inArray, ne } from "@stariva/db";
import { type WorkshopRow, workshops } from "@stariva/db/schema";
import { cache } from "react";
import {
  formatDurationLabel,
  type Workshop,
  type WorkshopStatus,
} from "@/lib/workshops-data";

/** Строка таблицы workshops → мастер-класс в виде, который ждут страницы. */
export function workshopRowToWorkshop(row: WorkshopRow): Workshop {
  const totalSeconds = row.lessons.reduce(
    (total, lesson) => total + lesson.durationSeconds,
    0,
  );
  return {
    slug: row.slug,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    level: row.level,
    price: row.price / 100,
    duration: totalSeconds > 0 ? formatDurationLabel(totalSeconds) : "",
    lessonsCount: row.lessons.length,
    cover: row.cover,
    previewImage: row.previewImage,
    description: row.description,
    whatYouLearn: row.whatYouLearn,
    materials: row.materials,
    lessons: row.lessons,
    materialFiles: row.materialFiles,
    ozonUrl: row.ozonUrl ?? undefined,
    featured: row.featured,
    testimonial:
      row.testimonialText && row.testimonialAuthor
        ? { text: row.testimonialText, author: row.testimonialAuthor }
        : undefined,
    releaseAt: row.releaseAt?.toISOString(),
  };
}

/**
 * Опубликованные мастер-классы в порядке витрины: каталог, sitemap, чат.
 * Если база недоступна (в том числе при сборке образа) — пустой список.
 */
export const fetchPublishedWorkshops = cache(async (): Promise<Workshop[]> => {
  try {
    const rows = await db
      .select()
      .from(workshops)
      .where(eq(workshops.status, "published"))
      .orderBy(asc(workshops.sortOrder), asc(workshops.createdAt));
    return rows.map(workshopRowToWorkshop);
  } catch (error) {
    logger.warn("workshops.list.unavailable", { error: String(error) });
    return [];
  }
});

/**
 * Мастер-класс по адресу. Публичные страницы и покупка берут только
 * опубликованные (`published`), кабинет и видео — ещё и архивные, чтобы
 * купившие не потеряли курс. Черновики не видны нигде.
 *
 * Ошибку базы не глотаем: страница должна упасть и не закэшировать 404.
 */
export const getWorkshopBySlug = cache(
  async (
    slug: string,
    scope: "published" | "owned" = "published",
  ): Promise<Workshop | undefined> => {
    const [row] = await db
      .select()
      .from(workshops)
      .where(
        and(
          eq(workshops.slug, slug),
          scope === "published"
            ? eq(workshops.status, "published")
            : ne(workshops.status, "draft"),
        ),
      )
      .limit(1);
    return row ? workshopRowToWorkshop(row) : undefined;
  },
);

/** Мастер-классы по списку адресов (кабинет: «Мои мастер-классы»), без черновиков. */
export async function getWorkshopsBySlugs(
  slugs: string[],
): Promise<Map<string, Workshop>> {
  if (slugs.length === 0) return new Map();
  const rows = await db
    .select()
    .from(workshops)
    .where(
      and(
        inArray(workshops.slug, slugs),
        ne(workshops.status, "draft" satisfies WorkshopStatus),
      ),
    );
  return new Map(rows.map((row) => [row.slug, workshopRowToWorkshop(row)]));
}
