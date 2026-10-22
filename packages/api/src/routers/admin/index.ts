import { adminCartsRouter } from "./carts";
import { adminChatsRouter } from "./chats";
import { adminContactClicksRouter } from "./contact-clicks";
import { adminCrmRouter } from "./crm";
import { adminOrdersRouter } from "./orders";
import { adminProductsRouter } from "./products";
import { adminReceiptsRouter } from "./receipts";
import { adminRequestsRouter } from "./requests";
import { adminReviewsRouter } from "./reviews";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";
import { adminWorkshopsRouter } from "./workshops";

export const adminRouter = {
  products: adminProductsRouter,
  orders: adminOrdersRouter,
  carts: adminCartsRouter,
  contactClicks: adminContactClicksRouter,
  receipts: adminReceiptsRouter,
  requests: adminRequestsRouter,
  reviews: adminReviewsRouter,
  workshops: adminWorkshopsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
  chats: adminChatsRouter,
  crm: adminCrmRouter,
};
