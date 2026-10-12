import { logger } from "@stariva/config";
import { db } from "@stariva/db";
import {
  orders,
  user,
  type WorkshopRow,
  workshopOrderNotifications,
  workshops,
} from "@stariva/db/schema";
import {
  StarivaWorkshopEmail,
  sendEmail,
  type WorkshopEmailKind,
} from "@stariva/emails";
import { and, between, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { baseEnv, env } from "@/env";
import {
  claimOrderNotification,
  completeOrderNotification,
  type NotificationChannel,
  releaseOrderNotification,
  type WorkshopOrder,
} from "@/lib/payments/orders";
import {
  clientBotStartUrl,
  escapeTelegramHtml,
  isClientBotConfigured,
  sendClientMessage,
} from "@/lib/telegram/client-bot";
import { deliverNotification } from "@/lib/custom-order/delivery";
import { notificationConfigured } from "@/lib/custom-order/inbox";
import { formatReleaseDateTime } from "@/lib/workshops-data";
import { googleCalendarUrl } from "./calendar";
import { earnsPreorderBonus } from "./preorder-bonus";
import {
  dueReminders,
  REMINDER_LOOKAHEAD_MS,
  REMINDER_LOOKBEHIND_MS,
  type ReminderKind,
} from "./reminder-schedule";
import { formatWorkshopPurchaseMessage } from "./staff-message";

/** Сколько повторять сообщение мастеру о покупке: старые покупки ему уже не нужны. */
const STAFF_RETRY_MS = 3 * 60 * 60 * 1000;

export function siteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? baseEnv.APP_URL).replace(/\/$/, "");
}

/** Личная ссылка входа: открывает кабинет мастер-класса без пароля. */
export function workshopAccessUrl(accessToken: string): string {
  return `${siteUrl()}/api/workshops/access/${accessToken}`;
}

export function workshopCourseUrl(slug: string): string {
  return `${siteUrl()}/account/workshops/${slug}`;
}

/** Ссылки «Добавить в календарь» для предзаказа. */
export function workshopCalendarLinks(workshop: {
  slug: string;
  title: string;
  releaseAt: Date;
}) {
  return {
    icsUrl: `${siteUrl()}/api/workshops/${workshop.slug}/calendar`,
    googleUrl: googleCalendarUrl({
      slug: workshop.slug,
      title: workshop.title,
      releaseAt: workshop.releaseAt,
      url: workshopCourseUrl(workshop.slug),
    }),
  };
}

interface Target {
  order: WorkshopOrder;
  workshop: WorkshopRow;
  email: string;
}

/** Предзаказ: старт ещё впереди. */
function upcomingRelease(workshop: WorkshopRow, now = new Date()) {
  return workshop.releaseAt && workshop.releaseAt > now
    ? workshop.releaseAt
    : null;
}

function emailSubject(kind: WorkshopEmailKind, target: Target): string {
  const title = `«${target.workshop.title}»`;
  switch (kind) {
    case "booked":
      return upcomingRelease(target.workshop)
        ? `Вы записаны на мастер-класс ${title} — Stariva`
        : `Доступ к мастер-классу ${title} открыт — Stariva`;
    case "week":
      return `Через неделю старт: ${title} — Stariva`;
    case "day":
      return `Завтра открываем уроки: ${title} — Stariva`;
    case "release":
      return `Уроки открыты: ${title} — Stariva`;
  }
}

function telegramText(kind: ReminderKind, target: Target): string {
  const title = escapeTelegramHtml(`«${target.workshop.title}»`);
  const when = target.workshop.releaseAt
    ? formatReleaseDateTime(target.workshop.releaseAt.toISOString())
    : "";
  const materials = target.workshop.materials
    .map((item) => `• ${escapeTelegramHtml(item)}`)
    .join("\n");
  switch (kind) {
    case "week":
      return [
        `🎄 До старта мастер-класса ${title} неделя: уроки откроются ${when}.`,
        materials ? `\nСамое время подготовить материалы:\n${materials}` : "",
      ].join("");
    case "day":
      return `⏰ Завтра, ${when}, открываем уроки мастер-класса ${title}. Проверьте, всё ли готово к работе!`;
    case "release":
      return `✨ Уроки мастер-класса ${title} открыты! Смотрите их в личном кабинете, когда удобно.`;
  }
}

async function claimed(
  target: Target,
  kind: WorkshopEmailKind,
  channel: NotificationChannel,
  send: () => Promise<void>,
): Promise<boolean> {
  const claimId = await claimOrderNotification(target.order.id, kind, channel);
  if (!claimId) {
    return false;
  }
  try {
    await send();
    await completeOrderNotification(claimId);
    return true;
  } catch (error) {
    await releaseOrderNotification(claimId);
    throw error;
  }
}

/**
 * Отправляет письмо о покупке или напоминание, резервируя уведомление от дублей.
 * Возвращает false без токена доступа или резерва, true после отправки;
 * при ошибке освобождает резерв и пробрасывает ошибку для повторной попытки.
 */
function deliverEmail(target: Target, kind: WorkshopEmailKind) {
  const { order, workshop } = target;
  if (!order.accessToken) return Promise.resolve(false);
  const accessToken = order.accessToken;
  const release = upcomingRelease(workshop);

  return claimed(target, kind, "email", () =>
    sendEmail({
      idempotencyKey: `workshop:${order.id}:${kind}:email`,
      to: [target.email],
      subject: emailSubject(kind, target),
      react: StarivaWorkshopEmail({
        kind,
        workshopTitle: workshop.title,
        releaseLabel: release
          ? formatReleaseDateTime(release.toISOString())
          : null,
        accessUrl: workshopAccessUrl(accessToken),
        materials: workshop.materials,
        calendar: release
          ? workshopCalendarLinks({ ...workshop, releaseAt: release })
          : undefined,
        telegramUrl:
          kind === "booked" &&
          release &&
          !order.telegramChatId &&
          order.telegramToken
            ? clientBotStartUrl(order.telegramToken)
            : undefined,
        bonus: earnsPreorderBonus({
          workshopSlug: workshop.slug,
          orderedAt: order.createdAt,
          releaseAt: workshop.releaseAt,
        }),
      }),
    }).then(() => undefined),
  );
}

/**
 * Сообщает мастеру о покупке. Без настроенных каналов — false без резерва,
 * при сбое обоих каналов — ошибка, и ближайший прогон напоминаний повторит.
 */
function deliverStaff(target: Target) {
  if (!notificationConfigured()) return Promise.resolve(false);
  const { title, message } = formatWorkshopPurchaseMessage(
    target.order,
    target.workshop,
    target.email,
  );
  return claimed(target, "booked", "staff", async () => {
    const delivered = await deliverNotification(
      {
        id: target.order.id,
        title,
        message,
        emailSubject: `${title} · Stariva`,
        idempotencyScope: "workshop-purchase",
        photoBase64: null,
        photoType: null,
      },
      {
        telegramToken: env.TELEGRAM_BOT_TOKEN,
        telegramChatId: env.TELEGRAM_CHAT_ID,
        emailKey: baseEnv.RESEND_API_KEY,
        emailFrom: env.ORDER_EMAIL_FROM,
        emailTo: env.ORDER_EMAIL_TO,
      },
    );
    if (!delivered) throw new Error("staff_notification_failed");
  });
}

function deliverTelegram(target: Target, kind: ReminderKind) {
  const chatId = target.order.telegramChatId;
  if (!chatId || !isClientBotConfigured()) return Promise.resolve(false);
  // Telegram не поддерживает идемпотентность: после сбоя между отправкой и
  // подтверждением аренды повторная попытка может продублировать сообщение.
  return claimed(target, kind, "telegram", () =>
    sendClientMessage(chatId, telegramText(kind, target), {
      text: kind === "release" ? "Смотреть уроки" : "Открыть кабинет",
      url: workshopCourseUrl(target.workshop.slug),
    }),
  );
}

async function loadTargets(where: Parameters<typeof and>[number]) {
  const rows = await db
    .select({ order: orders, workshop: workshops, email: user.email })
    .from(orders)
    .innerJoin(workshops, eq(workshops.slug, orders.workshopSlug))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(eq(orders.status, "paid"), isNotNull(orders.accessToken), where),
    );
  return rows satisfies Target[];
}

/**
 * Письмо о покупке покупателю и сообщение мастеру сразу после оплаты. Сбой
 * не роняет вебхук: недошедшее повторит ближайший прогон напоминаний (см.
 * runWorkshopReminderSweep).
 */
export async function notifyWorkshopBooked(orderId: string): Promise<void> {
  let target: Target | undefined;
  try {
    [target] = await loadTargets(eq(orders.id, orderId));
    if (target) await deliverEmail(target, "booked");
  } catch (error) {
    logger.error("workshop.booked_email.failed", {
      orderId,
      error: String(error),
    });
  }
  if (!target) return;
  if (!notificationConfigured()) {
    logger.error("workshop.staff_notification.not_configured", { orderId });
    return;
  }
  try {
    await deliverStaff(target);
  } catch (error) {
    logger.error("workshop.staff_notification.failed", {
      orderId,
      error: String(error),
    });
  }
}

/**
 * Прогон по расписанию (воркер Hatchet): дошлёт письма о покупке, которые не
 * ушли из вебхука, и разошлёт напоминания о старте. Аренда защищает от
 * параллельной отправки; после её истечения незавершённую попытку повторяем.
 * Resend дедуплицирует по ключу в пределах своего окна идемпотентности;
 * Telegram при восстановлении может получить повторное сообщение.
 */
export async function runWorkshopReminderSweep(now = new Date()) {
  const targets = await loadTargets(
    or(
      gte(orders.paidAt, new Date(now.getTime() - REMINDER_LOOKBEHIND_MS)),
      between(
        workshops.releaseAt,
        new Date(now.getTime() - REMINDER_LOOKBEHIND_MS),
        new Date(now.getTime() + REMINDER_LOOKAHEAD_MS),
      ),
    ),
  );

  const sentRows =
    targets.length === 0
      ? []
      : await db
          .select()
          .from(workshopOrderNotifications)
          .where(
            inArray(
              workshopOrderNotifications.orderId,
              targets.map((t) => t.order.id),
            ),
          );
  const sent = new Set(
    sentRows
      .filter((row) => row.sentAt !== null)
      .map((row) => `${row.orderId}:${row.kind}:${row.channel}`),
  );
  const isSent = (target: Target, kind: string, channel: NotificationChannel) =>
    sent.has(`${target.order.id}:${kind}:${channel}`);

  const jobs: Array<() => Promise<boolean>> = [];
  for (const target of targets) {
    const { order, workshop } = target;
    if (!order.paidAt) continue;

    const recentlyPaid =
      order.paidAt.getTime() >= now.getTime() - REMINDER_LOOKBEHIND_MS;
    if (recentlyPaid && !isSent(target, "booked", "email")) {
      jobs.push(() => deliverEmail(target, "booked"));
    }
    if (
      order.paidAt.getTime() >= now.getTime() - STAFF_RETRY_MS &&
      !isSent(target, "booked", "staff")
    ) {
      jobs.push(() => deliverStaff(target));
    }
    if (!workshop.releaseAt) continue;
    for (const kind of dueReminders({
      releaseAt: workshop.releaseAt,
      paidAt: order.paidAt,
      now,
    })) {
      if (!isSent(target, kind, "email")) {
        jobs.push(() => deliverEmail(target, kind));
      }
      if (order.telegramChatId && !isSent(target, kind, "telegram")) {
        jobs.push(() => deliverTelegram(target, kind));
      }
    }
  }

  let delivered = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (await job()) delivered++;
    } catch (error) {
      failed++;
      logger.error("workshop.reminder.failed", { error: String(error) });
    }
  }
  return { checked: targets.length, delivered, failed };
}
