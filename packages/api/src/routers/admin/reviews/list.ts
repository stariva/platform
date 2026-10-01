import { desc, reviews } from "@stariva/db";

import { adminProcedure } from "../../../orpc";

/** Все отзывы, включая скрытые, — новые сверху. */
export const list = adminProcedure.handler(async ({ context }) => {
  return context.db.select().from(reviews).orderBy(desc(reviews.reviewedAt));
});
