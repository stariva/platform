import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  orderReceipts,
  orderStatus,
  orders,
  type SQL,
  sql,
  user,
  workshops,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { workshopReceiptsExpected } from "../receipts/summary";
import { briefMissing, briefSentAt, workshopHasBrief } from "./brief";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

type OrderStatus = (typeof orderStatus.enumValues)[number];

/**
 * Заказы мастер-классов, свежие сверху: кто записался, на какой курс,
 * оплатил ли и успел ли до старта (предзаказ). По умолчанию — только
 * оплаченные; неоплаченные нужны, чтобы разобрать брошенные оплаты.
 * Поиск — по имени, почте аккаунта, почте из заказа и номеру заказа.
 *
 * Вместе со страницей отдаёт число заказов по статусам (для вкладок) и
 * курсы, на которые есть заказы (для фильтра).
 *
 * @example client.admin.workshops.orders({ workshop: "elka-makrame", status: "paid", limit: 50, offset: 0 })
 */
export const ordersList = adminProcedure
  .input(
    z.object({
      workshop: z.string().trim().min(1).max(200).optional(),
      status: z.enum([...orderStatus.enumValues, "all"]).default("paid"),
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const pattern = input.query ? `%${escapeLike(input.query)}%` : null;
    // Фильтр без статуса — по нему считаем вкладки
    const scope = and(
      input.workshop ? eq(orders.workshopSlug, input.workshop) : undefined,
      pattern
        ? or(
            ilike(user.name, pattern),
            ilike(user.email, pattern),
            ilike(orders.contactEmail, pattern),
            ilike(orders.id, pattern),
          )
        : undefined,
    );
    const where: SQL | undefined =
      input.status === "all"
        ? scope
        : and(scope, eq(orders.status, input.status));

    const [rows, [totals], byStatus, byWorkshop] = await Promise.all([
      context.db
        .select({
          id: orders.id,
          workshopSlug: orders.workshopSlug,
          workshopTitle: workshops.title,
          releaseAt: workshops.releaseAt,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          contactEmail: orders.contactEmail,
          amount: orders.amount,
          status: orders.status,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
          telegramLinked: sql<boolean>`${orders.telegramChatId} is not null`,
          hasBrief: workshopHasBrief,
          briefSentAt,
          receiptCount: sql<number>`(select count(*) from ${orderReceipts} where ${orderReceipts.workshopOrderId} = ${orders.id})::int`,
          receiptsUnsent: sql<number>`(select count(*) from ${orderReceipts} where ${orderReceipts.workshopOrderId} = ${orders.id} and ${orderReceipts.emailedAt} is null and coalesce(${orders.contactEmail}, ${user.email}) <> '')::int`,
          attribution: orders.attribution,
          visitor: orders.visitor,
        })
        .from(orders)
        .innerJoin(user, eq(user.id, orders.userId))
        .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug))
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ total: count() })
        .from(orders)
        .innerJoin(user, eq(user.id, orders.userId))
        .where(where),
      context.db
        .select({ status: orders.status, total: count() })
        .from(orders)
        .innerJoin(user, eq(user.id, orders.userId))
        .where(scope)
        .groupBy(orders.status),
      context.db
        .select({
          slug: orders.workshopSlug,
          title: workshops.title,
          paid: sql<number>`(count(*) filter (where ${orders.status} = 'paid'))::int`,
          briefMissing: sql<number>`(count(*) filter (where ${briefMissing}))::int`,
        })
        .from(orders)
        .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug))
        .groupBy(orders.workshopSlug, workshops.title)
        .orderBy(orders.workshopSlug),
    ]);

    const statusCounts = Object.fromEntries(
      orderStatus.enumValues.map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const row of byStatus) statusCounts[row.status] = row.total;

    return {
      items: rows.map(({ amount, releaseAt, attribution, ...row }) => ({
        ...row,
        // Чеков должно быть по числу оплат — по записи на курс одна
        receiptsExpected: workshopReceiptsExpected(row.status),
        // Копейки → рубли, как в остальной админке
        amount: amount / 100,
        // Предзаказ — оформлен до старта уроков (как подарок в applyWorkshopPayment)
        preorder:
          releaseAt !== null && row.createdAt.getTime() < releaseAt.getTime(),
        // Последний заход по метке перед заказом
        utmSource: attribution?.last.utm_source ?? null,
        utmCampaign: attribution?.last.utm_campaign ?? null,
      })),
      total: totals?.total ?? 0,
      statusCounts,
      workshops: byWorkshop.map((row) => ({
        slug: row.slug,
        title: row.title ?? row.slug,
        paid: row.paid,
        briefMissing: row.briefMissing,
      })),
    };
  });
