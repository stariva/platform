import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { RequestLimitHandlerPlugin } from "@orpc/server/plugins";
import { logger } from "@stariva/config";
import {
  createWebORPCContext,
  WEB_RPC_PATH,
  type WebServices,
  webErrorStatus,
  webErrorStatusMap,
  webRouter,
} from "@stariva/web-api";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { issueFormToken } from "@/lib/auth/antispam";
import { auth } from "@/lib/auth/server";
import {
  dispatchRequest,
  notificationConfigured,
  saveRequest,
} from "@/lib/custom-order/inbox";
import { createCustomOrderServices } from "@/lib/custom-order/services";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { runWorkshopReminderSweep } from "@/lib/workshops/notifications";
import { workshopFileServices } from "@/lib/workshops/signed-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Самый большой запрос — заявка с фото до 8 МБ; остальное намного меньше
const MAX_BODY_BYTES = 9 * 1024 * 1024;

// Логика, которая пока живёт в витрине: письма, Telegram, заказы и
// better-auth тянут за собой половину apps/web
const services: WebServices = {
  runWorkshopReminderSweep: () => runWorkshopReminderSweep(),
  issueFormToken: async () => issueFormToken((await auth.$context).secret),
  subscribeToNewsletter,
  customOrders: createCustomOrderServices({
    notificationConfigured,
    saveRequest,
    dispatchRequest,
    after,
  }),
  workshopFiles: workshopFileServices,
  revalidatePaths(paths) {
    for (const path of paths) {
      // Шаблон маршрута вроде /catalog/[category]/[slug] сбрасывает все его страницы
      if (path.includes("[")) revalidatePath(path, "page");
      else revalidatePath(path);
    }
  },
};

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
  plugins: [new RequestLimitHandlerPlugin({ maxBodySize: MAX_BODY_BYTES })],
  interceptors: [
    onError((error) => {
      // 4xx — штатные ответы (попытка отдана другому воркеру, неверный
      // секрет, ошибка в форме), в лог ошибок им не место
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
