import { adminChatsRouter } from "./chats";
import { adminCrmRouter } from "./crm";
import { adminOrdersRouter } from "./orders";
import { adminProductsRouter } from "./products";
import { adminRequestsRouter } from "./requests";
import { adminReviewsRouter } from "./reviews";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";
import { adminWorkshopsRouter } from "./workshops";

export const adminRouter = {
  products: adminProductsRouter,
  orders: adminOrdersRouter,
  requests: adminRequestsRouter,
  reviews: adminReviewsRouter,
  workshops: adminWorkshopsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
  chats: adminChatsRouter,
  crm: adminCrmRouter,
};
