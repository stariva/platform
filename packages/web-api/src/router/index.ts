import { os } from "../orpc";
import { adminRouter } from "./admin";
import { jobsRouter } from "./jobs";

/** `os.router` сверяет реализацию с контрактом ещё и в рантайме. */
export const webRouter = os.router({
  jobs: jobsRouter,
  admin: adminRouter,
});

export type WebRouter = typeof webRouter;
