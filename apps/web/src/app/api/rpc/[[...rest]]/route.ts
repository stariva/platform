import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { logger } from "@stariva/config";
import {
  createWebORPCContext,
  WEB_RPC_PATH,
  type WebServices,
  webErrorStatus,
  webErrorStatusMap,
  webRouter,
} from "@stariva/web-api";
import { auth } from "@/lib/auth/server";
import { runWorkshopReminderSweep } from "@/lib/workshops/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Рассылка о мастер-классах пока живёт в витрине: письма, Telegram и
// заказы тянут за собой половину apps/web
const services: WebServices = {
  runWorkshopReminderSweep: () => runWorkshopReminderSweep(),
};

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
  interceptors: [
    onError((error) => {
      // 4xx — штатные ответы (попытка отдана другому воркеру, неверный
      // секрет), в лог ошибок им не место
      if (error instanceof ORPCError && webErrorStatus(error.code) < 500) {
        return;
      }
      logger.error("web_orpc.handler_error", error);
    }),
  ],
});

async function handleRequest(request: Request) {
  const { matched, response } = await handler.handle(request, {
    prefix: WEB_RPC_PATH,
    context: () =>
      createWebORPCContext({
        headers: request.headers,
        services,
        getSession: () => auth.api.getSession({ headers: request.headers }),
      }),
  });
  return matched ? response : new Response("Not found", { status: 404 });
}

export const POST = handleRequest;
