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
import { formatReleaseDateTime } from "@/lib/workshops-data";
import { googleCalendarUrl } from "./calendar";
import {
  dueReminders,
  REMINDER_LOOKAHEAD_MS,
  REMINDER_LOOKBEHIND_MS,
  type ReminderKind,
} from "./reminder-schedule";

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
      return `⏰ Завтра, ${when}, открываем уроки мастер-класса ${title}. Проверьте, что материалы под рукой!`;
    case "release":
      return `✨ Уроки мастер-класса ${title} открыты! Смотрите в личном кабинете в любое время.`;
  }
}

async function claimed(
  target: Target,
  kind: WorkshopEmailKind,
  channel: NotificationChannel,
  send: () => Promise<void>,
): Promise<boolean> {
  if (!(await claimOrderNotification(target.order.id, kind, channel))) {
    return false;
  }
  try {
    await send();
    return true;
  } catch (error) {
    await releaseOrderNotification(target.order.id, kind, channel);
    throw error;
  }
}

function deliverEmail(target: Target, kind: WorkshopEmailKind) {
  const { order, workshop } = target;
  if (!order.accessToken) return Promise.resolve(false);
  const accessToken = order.accessToken;
  const release = upcomingRelease(workshop);

  return claimed(target, kind, "email", () =>
    sendEmail({
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
      }),
    }).then(() => undefined),
  );
}

function deliverTelegram(target: Target, kind: ReminderKind) {
  const chatId = target.order.telegramChatId;
  if (!chatId || !isClientBotConfigured()) return Promise.resolve(false);
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
 * Письмо о покупке сразу после оплаты. Сбой не роняет вебхук: письмо
 * повторит ближайший прогон напоминаний (см. runWorkshopReminderSweep).
 */
export async function notifyWorkshopBooked(orderId: string): Promise<void> {
  try {
    const [target] = await loadTargets(eq(orders.id, orderId));
    if (target) await deliverEmail(target, "booked");
  } catch (error) {
    logger.error("workshop.booked_email.failed", {
      orderId,
      error: String(error),
    });
  }
}

/**
 * Прогон по расписанию (воркер Hatchet): дошлёт письма о покупке, которые не
 * ушли из вебхука, и разошлёт напоминания о старте. Повторный и параллельный
 * запуск безопасны — каждую отправку закрепляет строка
 * workshop_order_notifications.
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
    sentRows.map((row) => `${row.orderId}:${row.kind}:${row.channel}`),
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
