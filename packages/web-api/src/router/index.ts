import { os } from "../orpc";
import { accountRouter } from "./account";
import { adminRouter } from "./admin";
import { jobsRouter } from "./jobs";

/** `os.router` сверяет реализацию с контрактом ещё и в рантайме. */
export const webRouter = os.router({
  jobs: jobsRouter,
  admin: adminRouter,
  account: accountRouter,
});

export type WebRouter = typeof webRouter;
