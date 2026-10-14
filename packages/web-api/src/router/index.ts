import { jobsRouter } from "./jobs";

export const webRouter = {
  jobs: jobsRouter,
};

export type WebRouter = typeof webRouter;
