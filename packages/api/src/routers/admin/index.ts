import { adminCampaignsRouter } from "./campaigns";
import { adminCartsRouter } from "./carts";
import { adminContactClicksRouter } from "./contact-clicks";
import { adminCrmRouter } from "./crm";
import { adminEmailLogRouter } from "./email-log";
import { adminMetrikaRouter } from "./metrika";
import { adminOrdersRouter } from "./orders";
import { adminPagespeedRouter } from "./pagespeed";
import { adminProductsRouter } from "./products";
import { adminPromoCodesRouter } from "./promo-codes";
import { adminPurchaseMapRouter } from "./purchase-map";
import { adminReceiptsRouter } from "./receipts";
import { adminRequestsRouter } from "./requests";
import { adminReviewsRouter } from "./reviews";
import { adminSiteHealthRouter } from "./site-health";
import { adminStatsRouter } from "./stats";
import { adminUsersRouter } from "./users";
import { adminWorkshopsRouter } from "./workshops";

export const adminRouter = {
  products: adminProductsRouter,
  promoCodes: adminPromoCodesRouter,
  orders: adminOrdersRouter,
  carts: adminCartsRouter,
  purchaseMap: adminPurchaseMapRouter,
  contactClicks: adminContactClicksRouter,
  emailLog: adminEmailLogRouter,
  campaigns: adminCampaignsRouter,
  receipts: adminReceiptsRouter,
  requests: adminRequestsRouter,
  reviews: adminReviewsRouter,
  workshops: adminWorkshopsRouter,
  users: adminUsersRouter,
  stats: adminStatsRouter,
  crm: adminCrmRouter,
  metrika: adminMetrikaRouter,
  pagespeed: adminPagespeedRouter,
  siteHealth: adminSiteHealthRouter,
};
