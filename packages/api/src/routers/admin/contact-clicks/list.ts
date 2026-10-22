import {
  adCampaigns,
  adExpenses,
  and,
  CONTACT_CHANNELS,
  contactClicks,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  productOrders,
  type SQL,
  sql,
  user,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema } from "../crm/report";
import { byId, rubles, sourceView } from "../crm/shape";
import { clickSource, siteOf, summarize } from "./model";

const DAY = 24 * 60 * 60 * 1000;

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Переходы в мессенджеры и звонки за период, свежие сверху: кто (аккаунт,
 * IP, город, устройство), с какого блока и страницы, с какой рекламы и
 * откуда пришёл, а если этот браузер потом оформил заказ — его номер.
 *
 * Вместе со страницей отдаёт сводку за период: переходы и люди по каналам,
 * по рекламным кампаниям рядом с их расходом и, для заходов не с рекламы,
 * по сайтам-источникам. Сводка — по периоду и каналу, без поиска.
 * `to` — последний день периода включительно.
 *
 * @example client.admin.contactClicks.list({ from: "2026-10-01", to: "2026-10-31", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
      channel: z.enum(CONTACT_CHANNELS).optional(),
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const period: SQL[] = [];
    if (input.from) {
      period.push(gte(contactClicks.createdAt, moscowDay(input.from)));
    }
    if (input.to) {
      period.push(
        lt(
          contactClicks.createdAt,
          new Date(moscowDay(input.to).getTime() + DAY),
        ),
      );
    }
    if (input.channel) period.push(eq(contactClicks.channel, input.channel));

    const filters = [...period];
    if (input.query) {
      // jsonb в текстовом виде хранит кириллицу как есть
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(sql`(
        ${contactClicks.ip} ilike ${pattern}
        or ${contactClicks.source} ilike ${pattern}
        or ${contactClicks.page} ilike ${pattern}
        or ${contactClicks.entry}::text ilike ${pattern}
        or ${contactClicks.attribution}::text ilike ${pattern}
        or ${contactClicks.visitor}->>'city' ilike ${pattern}
        or ${user.name} ilike ${pattern}
        or ${user.email} ilike ${pattern}
      )`);
    }
    const where = and(...filters);

    const expenseDays: SQL[] = [];
    if (input.from) expenseDays.push(gte(adExpenses.spentOn, input.from));
    if (input.to) expenseDays.push(lte(adExpenses.spentOn, input.to));

    // Заказ, которым кончилась корзина этого браузера (последний)
    const orderId = sql<string | null>`(
      select ce.order_id from cart_events ce
      where ce.cart_id = ${contactClicks.browserId} and ce.order_id is not null
        and ce.created_at > ${contactClicks.createdAt}
      order by ce.created_at desc limit 1
    )`;

    const [rows, [totals], summaryClicks, campaigns, expenses] =
      await Promise.all([
        context.db
          .select({
            id: contactClicks.id,
            createdAt: contactClicks.createdAt,
            channel: contactClicks.channel,
            source: contactClicks.source,
            page: contactClicks.page,
            entry: contactClicks.entry,
            attribution: contactClicks.attribution,
            ip: contactClicks.ip,
            visitor: contactClicks.visitor,
            browserId: contactClicks.browserId,
            userId: contactClicks.userId,
            userName: user.name,
            userEmail: user.email,
            // Сколько раз этот браузер переходил в мессенджеры за всё время
            browserClicks: sql<number>`(
              select count(*)::int from contact_clicks cc
              where cc.browser_id = ${contactClicks.browserId}
            )`,
            hasCart: sql<boolean>`exists (
              select 1 from cart_events ce where ce.cart_id = ${contactClicks.browserId}
            )`,
            orderId,
          })
          .from(contactClicks)
          .leftJoin(user, eq(user.id, contactClicks.userId))
          .where(where)
          .orderBy(desc(contactClicks.createdAt), desc(contactClicks.id))
          .limit(input.limit)
          .offset(input.offset),
        context.db
          .select({ total: count() })
          .from(contactClicks)
          .leftJoin(user, eq(user.id, contactClicks.userId))
          .where(where),
        context.db
          .select({
            id: contactClicks.id,
            browserId: contactClicks.browserId,
            ip: contactClicks.ip,
            channel: contactClicks.channel,
            entry: contactClicks.entry,
            attribution: contactClicks.attribution,
          })
          .from(contactClicks)
          .where(and(...period)),
        context.db.select().from(adCampaigns),
        context.db
          .select({
            campaignId: adExpenses.campaignId,
            amount: sql<number>`sum(${adExpenses.amount})::int`,
          })
          .from(adExpenses)
          .where(and(...expenseDays))
          .groupBy(adExpenses.campaignId),
      ]);

    const orderIds = [...new Set(rows.flatMap((row) => row.orderId ?? []))];
    const orders = orderIds.length
      ? await context.db
          .select({
            id: productOrders.id,
            number: productOrders.number,
            status: productOrders.status,
          })
          .from(productOrders)
          .where(inArray(productOrders.id, orderIds))
      : [];
    const ordersById = new Map(orders.map((order) => [order.id, order]));

    const campaignsById = byId(campaigns);
    const summary = summarize(
      summaryClicks,
      campaigns,
      new Map(expenses.map((row) => [row.campaignId, row.amount])),
    );

    return {
      items: rows.map(({ orderId: rowOrderId, ...row }) => ({
        ...row,
        campaign: sourceView(
          clickSource(row.entry, row.attribution, campaigns),
          campaignsById,
        ),
        site: siteOf(row.entry),
        order: rowOrderId ? (ordersById.get(rowOrderId) ?? null) : null,
      })),
      total: totals?.total ?? 0,
      summary: {
        total: summary.total,
        sources: summary.sources.map(({ source, spend, ...row }) => ({
          ...row,
          source: sourceView(source, campaignsById),
          spend: rubles(spend),
        })),
        sites: summary.sites,
      },
    };
  });
