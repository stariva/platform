import { os } from "../orpc";
import { jobsRouter } from "./jobs";

/** `os.router` сверяет реализацию с контрактом ещё и в рантайме. */
export const webRouter = os.router({
  jobs: jobsRouter,
});

export type WebRouter = typeof webRouter;
