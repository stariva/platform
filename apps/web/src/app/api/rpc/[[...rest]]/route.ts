import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { RequestLimitHandlerPlugin } from "@orpc/server/plugins";
import { corsPreflight, withCors } from "@stariva/auth/cors";
import { logger } from "@stariva/config";
import {
  and,
  db,
  eq,
  isNotNull,
  orders,
  workshopOrderNotifications,
} from "@stariva/db";
import { syncPostboxEvents } from "@stariva/emails";
import {
  createWebORPCContext,
  sweepWorkshopStorage,
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
import { runCampaignSweep } from "@/lib/campaigns/sweep";
import { checkoutServices } from "@/lib/commerce/checkout-services";
import { notifyStaffAlert } from "@/lib/commerce/order-notifications";
import { orderServices } from "@/lib/commerce/order-services";
import {
  dispatchRequest,
  notificationConfigured,
  saveRequest,
} from "@/lib/custom-order/inbox";
import { createCustomOrderServices } from "@/lib/custom-order/services";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { runNpdIssuingSweep } from "@/lib/npd/issuing-sweep";
import { issueBoostyOrderReceipt } from "@/lib/workshops/boosty-receipt";
import {
  notifyWorkshopBooked,
  runWorkshopReminderSweep,
} from "@/lib/workshops/notifications";
import { formatWorkshopReviewMessage } from "@/lib/workshops/review-message";
import { workshopFileServices } from "@/lib/workshops/signed-media";
import { runUnpaidOrderSweep } from "@/lib/workshops/unpaid-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Самые большие запросы — заявка с фото до 8 МБ и отзыв с тремя фото по
// 2,5 МБ; остальное намного меньше
const MAX_BODY_BYTES = 9 * 1024 * 1024;

const EMAIL_EVENTS_BUDGET_MS = 40_000;

// Логика, которая пока живёт в витрине: письма, Telegram, заказы и
// better-auth тянут за собой половину apps/web
const services: WebServices = {
  async notifyBoostyOrder(orderId) {
    const [order] = await db
      .select({ status: orders.status, paymentId: orders.paymentId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (order?.status !== "paid" || !order.paymentId?.startsWith("boosty:"))
      throw new Error("boosty_order_not_paid");
    await notifyWorkshopBooked(orderId);
    const [notice] = await db
      .select({ id: workshopOrderNotifications.id })
      .from(workshopOrderNotifications)
      .where(
        and(
          eq(workshopOrderNotifications.orderId, orderId),
          eq(workshopOrderNotifications.kind, "booked"),
          eq(workshopOrderNotifications.channel, "email"),
          isNotNull(workshopOrderNotifications.sentAt),
        ),
      )
      .limit(1);
    return Boolean(notice);
  },
  issueBoostyReceipt: issueBoostyOrderReceipt,
  // Один крон воркера на все письма по мастер-классам: покупка, старт и
  // «оплата не завершилась». Заодно дошлёт рассылки из админки
  async runWorkshopReminderSweep() {
    const now = new Date();
    let results: Awaited<ReturnType<typeof runUnpaidOrderSweep>>[];
    try {
      results = [
        await runWorkshopReminderSweep(now),
        await runUnpaidOrderSweep(now),
      ];
    } catch (error) {
      // Рассылки дошлём и при сбое напоминаний; наружу — ошибка напоминаний
      await runCampaignSweep().catch(() => {});
      throw error;
    }
    await runCampaignSweep();
    return {
      checked: results.reduce((sum, r) => sum + r.checked, 0),
      delivered: results.reduce((sum, r) => sum + r.delivered, 0),
      failed: results.reduce((sum, r) => sum + r.failed, 0),
    };
  },
  runWorkshopStorageSweep: sweepWorkshopStorage,
  runNpdIssuingSweep,
  // Крон раз в минуту: читаем не дольше, чтобы прогоны не наезжали друг на друга
  syncEmailEvents: () =>
    syncPostboxEvents({ deadline: Date.now() + EMAIL_EVENTS_BUDGET_MS }),
  issueFormToken: async () => issueFormToken((await auth.$context).secret),
  subscribeToNewsletter,
  customOrders: createCustomOrderServices({
    notificationConfigured,
    saveRequest,
    dispatchRequest,
    after,
  }),
  workshopFiles: workshopFileServices,
  orders: orderServices,
  checkout: checkoutServices,
  notifyWorkshopReview(notice) {
    after(() =>
      notifyStaffAlert(
        // Каждая отправка — отдельное сообщение: правка тоже требует проверки
        `review/${notice.workshopSlug}/${notice.email}/${Date.now()}`,
        formatWorkshopReviewMessage(notice),
        "workshop-review",
      ),
    );
  },
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
      // data у REMINDERS_FAILED — сколько отправок не ушло; причины в своих строках лога
      logger.error(
        "web_orpc.handler_error",
        error,
        error instanceof ORPCError
          ? { code: error.code, data: error.data }
          : undefined,
      );
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

// CORS — для мобильного приложения (Capacitor), другой origin. Точные origin'ы
// без `*` и без cookie: приложение входит bearer-токеном (@stariva/auth/cors)
export const POST = async (request: Request) =>
  withCors(request, await handleRequest(request));

export const OPTIONS = (request: Request) => corsPreflight(request);
