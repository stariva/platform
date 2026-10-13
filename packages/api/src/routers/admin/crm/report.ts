import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadCrm } from "./load";
import {
  buildReport,
  moscowDay,
  type Period,
  type ReportRow,
  toMoscowDay,
} from "./model";
import { byId, rubles, sourceView } from "./shape";

export const daySchema = z.iso.date();

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
    }),
    { spend: 0, leads: 0, buyers: 0, paidDeals: 0, revenue: 0 },
  );

const inRubles = <T extends { spend: number; revenue: number }>(row: T) => ({
  ...row,
  spend: rubles(row.spend),
  revenue: rubles(row.revenue),
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
    const { campaigns, expenses, clients } = await loadCrm(context.db);
    const campaignsById = byId(campaigns);
    const period: Period = {
      from: input.from ? moscowDay(input.from) : null,
      to: input.to ? new Date(moscowDay(input.to).getTime() + DAY) : null,
    };

    const rows = buildReport(
      clients,
      expenses,
      campaigns.filter((c) => !c.archived).map((c) => c.id),
      period,
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
