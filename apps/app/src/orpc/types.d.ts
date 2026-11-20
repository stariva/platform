import type { RouterClient } from "@orpc/server";
import type { appRouter } from "@stariva/api";

declare global {
  // eslint-disable-next-line no-var
  var $client: RouterClient<typeof appRouter> | undefined;
}
