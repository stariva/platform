import { adminProductsRouter } from "./products";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";

export const adminRouter = {
  products: adminProductsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
};
