import { os } from "../orpc";
import { accountRouter } from "./account";
import { adminRouter } from "./admin";
import { formsRouter } from "./forms";
import { jobsRouter } from "./jobs";
import { ordersRouter } from "./orders";

/** `os.router` сверяет реализацию с контрактом ещё и в рантайме. */
export const webRouter = os.router({
  jobs: jobsRouter,
  admin: adminRouter,
  account: accountRouter,
  forms: formsRouter,
  orders: ordersRouter,
});

export type WebRouter = typeof webRouter;
