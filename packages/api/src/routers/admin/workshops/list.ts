import { asc, workshops } from "@stariva/db";

import { adminProcedure } from "../../../orpc";

/** Все мастер-классы, включая черновики и архив, в порядке витрины. */
export const list = adminProcedure.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: workshops.id,
      slug: workshops.slug,
      title: workshops.title,
      category: workshops.category,
      level: workshops.level,
      status: workshops.status,
      price: workshops.price,
      cover: workshops.cover,
      lessons: workshops.lessons,
      featured: workshops.featured,
      sortOrder: workshops.sortOrder,
      updatedAt: workshops.updatedAt,
    })
    .from(workshops)
    .orderBy(asc(workshops.sortOrder), asc(workshops.createdAt));

  return rows.map(({ lessons, price, ...row }) => ({
    ...row,
    price: price / 100,
    lessonsCount: lessons.length,
    withoutVideo: lessons.filter((lesson) => !lesson.videoKey).length,
    durationSeconds: lessons.reduce(
      (total, lesson) => total + lesson.durationSeconds,
      0,
    ),
  }));
});
