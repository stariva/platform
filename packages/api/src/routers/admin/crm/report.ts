import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { costEntries } from "./economics";
import {
  buildReport,
  type Deal,
  moscowDay,
  type Period,
  type ReportRow,
  toMoscowDay,
} from "./model";
import { loadWork } from "./orders";
import { byId, daySchema, rubles, sourceView } from "./shape";

const DAY = 24 * 60 * 60 * 1000;

/** Первый день месяца, отстоящего от месяца `day` на `shift`: «2026-10-13», -1 → «2026-09-01». */
function monthStart(day: string, shift: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, month + shift, 1)).toISOString().slice(0, 10);
}

const sum = (rows: ReportRow[]) =>
  rows.reduce(
    (total, row) => ({
      spend: total.spend + row.spend,
      leads: total.leads + row.leads,
      buyers: total.buyers + row.buyers,
      paidDeals: total.paidDeals + row.paidDeals,
      revenue: total.revenue + row.revenue,
      costs: total.costs + row.costs,
    }),
    { spend: 0, leads: 0, buyers: 0, paidDeals: 0, revenue: 0, costs: 0 },
  );

const inRubles = <T extends { spend: number; revenue: number; costs: number }>(
  row: T,
) => ({
  ...row,
  spend: rubles(row.spend),
  revenue: rubles(row.revenue),
  costs: rubles(row.costs),
  // Что осталось после затрат на заказы и самой рекламы
  profit: rubles(row.revenue - row.costs - row.spend),
});

/** С рекламы — клиенты, у которых есть метка или кампания. */
const fromAds = (row: ReportRow) => row.source.kind !== "none";

/**
 * Сводка по рекламе за период: расход, новые обращения и покупатели,
 * выручка по каждой кампании; плюс помесячно за последний год.
 * `to` — последний день периода включительно.
 *
 * @example client.admin.crm.report({ from: "2026-10-01", to: "2026-10-31" })
 */
export const report = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { campaigns, expenses, clients, orders, rates } = await loadWork(
      context.db,
    );
    const campaignsById = byId(campaigns);
    const ordersByDeal = new Map(
      orders.map((order) => [`${order.kind}:${order.id}`, order]),
    );
    const costsOf = (deal: Deal) => {
      const order = ordersByDeal.get(`${deal.kind}:${deal.id}`);
      return order ? costEntries(order, rates) : [];
    };
    const period: Period = {
      from: input.from ? moscowDay(input.from) : null,
      to: input.to ? new Date(moscowDay(input.to).getTime() + DAY) : null,
    };

    const rows = buildReport(
      clients,
      expenses,
      campaigns.filter((c) => !c.archived).map((c) => c.id),
      period,
      costsOf,
    ).filter(
      (row) =>
        row.source.kind === "campaign" ||
        row.leads + row.buyers + row.revenue + row.spend > 0,
    );

    const today = toMoscowDay(new Date());
    const months = Array.from({ length: 12 }, (_, index) => {
      const start = monthStart(today, index - 11);
      const monthRows = buildReport(clients, expenses, [], {
        from: moscowDay(start),
        to: moscowDay(monthStart(start, 1)),
      });
      const ads = sum(monthRows.filter(fromAds));
      const all = sum(monthRows);
      return {
        month: start.slice(0, 7),
        spend: rubles(all.spend),
        adRevenue: rubles(ads.revenue),
        adBuyers: ads.buyers,
        revenue: rubles(all.revenue),
        buyers: all.buyers,
      };
    });

    return {
      rows: rows.map((row) => ({
        ...inRubles(row),
        source: sourceView(row.source, campaignsById),
      })),
      ads: inRubles(sum(rows.filter(fromAds))),
      total: inRubles(sum(rows)),
      months,
    };
  });
