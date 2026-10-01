import { adminProductsRouter } from "./products";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";
import { adminWorkshopsRouter } from "./workshops";

export const adminRouter = {
  products: adminProductsRouter,
  workshops: adminWorkshopsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
};
