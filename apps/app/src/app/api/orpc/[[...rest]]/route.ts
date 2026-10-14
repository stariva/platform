import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { appRouter, createORPCContext } from "@stariva/api";
import { logger } from "@stariva/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      logger.error("orpc.handler_error", error);
    }),
  ],
});

async function handleRequest(request: Request) {
  const { matched, response } = await handler.handle(request, {
    prefix: "/api/orpc",
    // Сессию грузим, только когда запрос дошёл до процедуры
    context: async () => {
      const { auth } = await import("~/auth/server");
      const session = await auth.api.getSession({ headers: request.headers });
      return createORPCContext({ headers: request.headers, session });
    },
  });

  return matched ? response : new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
