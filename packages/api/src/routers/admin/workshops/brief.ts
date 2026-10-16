import { ORPCError } from "@orpc/server";
import { env, logger } from "@stariva/config";
import {
  and,
  asc,
  type Database,
  eq,
  inArray,
  orders,
  type SQL,
  sql,
  user,
  type WorkshopRow,
  workshopOrderNotifications,
  workshops,
} from "@stariva/db";
import {
  sendWorkshopBriefEmail,
  type WorkshopBriefFile,
} from "@stariva/emails";
import { loadWorkshopMaterials } from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Куда ведёт кнопка «Открыть кабинет», если адрес витрины не задан. */
const DEFAULT_STOREFRONT_URL = "https://stariva.ru";

/**
 * Вид отправки в workshop_order_notifications. Тот же вид пишет сайт, когда
 * прикладывает бриф к письму о покупке или досылает его отдельно.
 */
const BRIEF = "brief";

/** Когда бриф ушёл покупателю письмом; null — ещё не уходил. */
export const briefSentAt =
  sql<Date | null>`(select ${workshopOrderNotifications.sentAt} from ${workshopOrderNotifications} where ${workshopOrderNotifications.orderId} = ${orders.id} and ${workshopOrderNotifications.kind} = ${BRIEF} and ${workshopOrderNotifications.channel} = 'email')`.mapWith(
    workshopOrderNotifications.sentAt,
  );

/** У курса есть PDF-бриф — его можно отправить. */
export const workshopHasBrief = sql<boolean>`coalesce(jsonb_array_length(${workshops.materialFiles}) > 0, false)`;

/** Оплаченная запись, которой бриф положен, но письмом ещё не уходил. */
export const briefMissing: SQL = sql`${orders.status} = 'paid' and ${workshopHasBrief} and ${briefSentAt} is null`;

function accessUrl(order: { accessToken: string | null; slug: string }) {
  const site = (env.STOREFRONT_URL ?? DEFAULT_STOREFRONT_URL).replace(
    /\/$/,
    "",
  );
  // Старые заказы без личной ссылки — в кабинет через обычный вход
  return order.accessToken
    ? `${site}/api/workshops/access/${order.accessToken}`
    : `${site}/account/workshops/${order.slug}`;
}

interface Recipient {
  orderId: string;
  slug: string;
  accessToken: string | null;
  to: string | null;
}

const recipientColumns = {
  orderId: orders.id,
  slug: orders.workshopSlug,
  accessToken: orders.accessToken,
  to: sql<
    string | null
  >`coalesce(nullif(${orders.contactEmail}, ''), ${user.email})`,
};

/** Курс и его PDF, скачанные один раз на всю рассылку. */
async function loadBrief(db: Database, slug: string) {
  const [workshop] = await db
    .select()
    .from(workshops)
    .where(eq(workshops.slug, slug));
  if (!workshop) {
    throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
  }
  if (workshop.materialFiles.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "У мастер-класса нет PDF — загрузите бриф в карточке курса",
    });
  }
  try {
    return {
      workshop,
      files: await loadWorkshopMaterials(workshop.materialFiles),
    };
  } catch (error) {
    logger.error("workshops.brief.load_failed", error, { slug });
    throw new ORPCError("BAD_GATEWAY", {
      message: "Не удалось скачать PDF из хранилища. Попробуйте ещё раз",
    });
  }
}

/** Сохраняет отметку отдельно от доставки: эту операцию безопасно повторять. */
async function recordBriefSent(db: Database, orderId: string) {
  try {
    await db
      .insert(workshopOrderNotifications)
      .values({
        orderId,
        kind: BRIEF,
        channel: "email",
        sentAt: sql`now()`,
        leaseUntil: null,
      })
      .onConflictDoUpdate({
        target: [
          workshopOrderNotifications.orderId,
          workshopOrderNotifications.kind,
          workshopOrderNotifications.channel,
        ],
        set: { sentAt: sql`now()`, leaseUntil: null },
      });
    return { recorded: true, warning: null };
  } catch (error) {
    logger.error("workshops.brief.mark_failed", error, { orderId });
    return {
      recorded: false,
      warning: "Письмо отправлено, но отметка не сохранена",
    };
  }
}

/** Ошибка доставки пробрасывается, сбой отметки возвращается отдельно. */
async function sendTo(
  db: Database,
  recipient: Recipient & { to: string },
  brief: { workshop: WorkshopRow; files: WorkshopBriefFile[] },
  idempotencyKey?: string,
) {
  await sendWorkshopBriefEmail({
    idempotencyKey,
    to: recipient.to,
    workshopTitle: brief.workshop.title,
    accessUrl: accessUrl(recipient),
    files: brief.files,
  });
  return recordBriefSent(db, recipient.orderId);
}

/**
 * Отправляет PDF-бриф одному покупателю — в первый раз или повторно.
 *
 * @example client.admin.workshops.sendBrief({ orderId })
 */
export const sendBrief = adminProcedure
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [recipient] = await context.db
      .select({ ...recipientColumns, status: orders.status })
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .where(eq(orders.id, input.orderId));
    if (!recipient) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    if (recipient.status !== "paid") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Бриф отправляем только оплатившим",
      });
    }
    const { to } = recipient;
    if (!to) {
      throw new ORPCError("BAD_REQUEST", { message: "У покупателя нет email" });
    }
    const brief = await loadBrief(context.db, recipient.slug);
    try {
      // Без ключа идемпотентности: повторная отправка — осознанное действие
      return { to, ...(await sendTo(context.db, { ...recipient, to }, brief)) };
    } catch (error) {
      logger.error("workshops.brief.send_failed", error, {
        orderId: input.orderId,
      });
      throw new ORPCError("BAD_GATEWAY", {
        message: "Письмо не ушло, попробуйте ещё раз",
      });
    }
  });

/**
 * Отправляет PDF-бриф всем оплатившим курс, кому он ещё не уходил. Каждое
 * письмо отмечается сразу, поэтому после сбоя повторный запуск дошлёт
 * только оставшимся.
 *
 * @example client.admin.workshops.sendMissingBriefs({ workshop: "elka-makrame" })
 */
export const sendMissingBriefs = adminProcedure
  .input(
    z.object({
      workshop: z.string().trim().min(1).max(200),
      // Только заказы с подтверждённой доставкой и несохранённой отметкой.
      // В этом режиме письма не отправляются даже после истечения окна Resend.
      recordOnlyOrderIds: z.array(z.string().min(1)).min(1).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const brief = input.recordOnlyOrderIds
      ? null
      : await loadBrief(context.db, input.workshop);
    const recipients = await context.db
      .select(recipientColumns)
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .innerJoin(workshops, eq(workshops.slug, orders.workshopSlug))
      .where(
        and(
          eq(orders.workshopSlug, input.workshop),
          briefMissing,
          input.recordOnlyOrderIds
            ? inArray(orders.id, input.recordOnlyOrderIds)
            : undefined,
        ),
      )
      .orderBy(asc(orders.paidAt));

    let sent = 0;
    let recovered = 0;
    const failed: string[] = [];
    const unmarked: Array<{ orderId: string; to: string | null }> = [];
    for (const recipient of recipients) {
      const { to } = recipient;
      if (!brief) {
        const result = await recordBriefSent(context.db, recipient.orderId);
        if (result.recorded) recovered++;
        else unmarked.push({ orderId: recipient.orderId, to });
        continue;
      }
      if (!to) {
        failed.push(`заказ ${recipient.orderId}: нет email`);
        continue;
      }
      try {
        // Тот же ключ, что у сайта: письмо не задвоится, если сайт как раз
        // досылает бриф этому покупателю
        const result = await sendTo(
          context.db,
          { ...recipient, to },
          brief,
          `workshop:${recipient.orderId}:${BRIEF}:email`,
        );
        sent++;
        if (!result.recorded) {
          unmarked.push({ orderId: recipient.orderId, to });
        }
      } catch (error) {
        logger.error("workshops.brief.send_failed", error, {
          orderId: recipient.orderId,
        });
        failed.push(to);
      }
    }
    return { sent, failed, unmarked, recovered };
  });
