import { adminOrdersRouter } from "./orders";
import { adminProductsRouter } from "./products";
import { adminReviewsRouter } from "./reviews";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";
import { adminWorkshopsRouter } from "./workshops";

export const adminRouter = {
  products: adminProductsRouter,
  orders: adminOrdersRouter,
  reviews: adminReviewsRouter,
  workshops: adminWorkshopsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
};
