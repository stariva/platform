import { asc, orders, sql, workshops } from "@stariva/db";
import { currentWorkshopPrice } from "@stariva/validators";

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
      priceAfterRelease: workshops.priceAfterRelease,
      releaseAt: workshops.releaseAt,
      cover: workshops.cover,
      lessons: workshops.lessons,
      featured: workshops.featured,
      sortOrder: workshops.sortOrder,
      updatedAt: workshops.updatedAt,
      paidOrders: sql<number>`(select count(*)::int from ${orders} where ${orders}.workshop_slug = ${workshops}.slug and ${orders}.status = 'paid')`,
    })
    .from(workshops)
    .orderBy(asc(workshops.sortOrder), asc(workshops.createdAt));

  return rows.map(({ lessons, price, priceAfterRelease, ...row }) => ({
    ...row,
    // Цена, по которой курс продаётся на сайте сейчас
    price:
      currentWorkshopPrice({
        price,
        priceAfterRelease,
        releaseAt: row.releaseAt,
      }) / 100,
    lessonsCount: lessons.length,
    withoutVideo: lessons.filter((lesson) => !lesson.videoKey).length,
    durationSeconds: lessons.reduce(
      (total, lesson) => total + lesson.durationSeconds,
      0,
    ),
  }));
});
