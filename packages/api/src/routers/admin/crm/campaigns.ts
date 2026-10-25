import { ORPCError } from "@orpc/server";
import { adCampaigns, adExpenses, desc, eq } from "@stariva/db";
import { syncDirectExpenses } from "@stariva/web-api";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toKopecks } from "../orders/stage-math";
import { loadCrm } from "./load";
import { buildReport, normalizeUtm } from "./model";
import { daySchema } from "./report";
import { byId, isUniqueViolation, rubles, sourceView } from "./shape";

const CHANNELS = [
  "yandex_direct",
  "vk_ads",
  "telegram",
  "avito",
  "bloggers",
  "social",
  "other",
] as const;

/**
 * Кампании с итогами за всё время: сколько потрачено, сколько клиентов
 * пришло и сколько они принесли.
 *
 * @example client.admin.crm.campaigns()
 */
export const campaigns = adminProcedure.handler(async ({ context }) => {
  const { campaigns: rows, expenses, clients } = await loadCrm(context.db);
  const totals = new Map(
    buildReport(
      clients,
      expenses,
      rows.map((row) => row.id),
      { from: null, to: null },
    ).map((row) => [row.key, row]),
  );
  return rows.map((campaign) => {
    const total = totals.get(`c:${campaign.id}`);
    const lastExpense = expenses
      .filter((expense) => expense.campaignId === campaign.id)
      .reduce<string | null>(
        (last, expense) =>
          !last || expense.spentOn > last ? expense.spentOn : last,
        null,
      );
    return {
      ...campaign,
      spend: rubles(total?.spend ?? 0),
      leads: total?.leads ?? 0,
      buyers: total?.buyers ?? 0,
      revenue: rubles(total?.revenue ?? 0),
      lastExpense,
    };
  });
});

/** Кампания с расходами, новые сверху, и итогами за всё время. */
export const campaign = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select()
      .from(adCampaigns)
      .where(eq(adCampaigns.id, input.id));
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Кампания не найдена" });
    }
    const [expenses, crm] = await Promise.all([
      context.db
        .select()
        .from(adExpenses)
        .where(eq(adExpenses.campaignId, input.id))
        .orderBy(desc(adExpenses.spentOn), desc(adExpenses.createdAt)),
      loadCrm(context.db),
    ]);
    const total = buildReport(crm.clients, crm.expenses, [row.id], {
      from: null,
      to: null,
    }).find((r) => r.key === `c:${row.id}`);
    const campaignsById = byId(crm.campaigns);
    const clients = crm.clients
      .filter(
        (client) =>
          client.source.kind === "campaign" &&
          client.source.campaignId === row.id,
      )
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
      .map((client) => ({
        key: client.key,
        name: client.name,
        firstSeenAt: client.firstSeenAt,
        revenue: rubles(client.revenue),
        manual: sourceView(client.source, campaignsById).manual,
      }));
    return {
      campaign: row,
      expenses: expenses.map((expense) => ({
        ...expense,
        amount: rubles(expense.amount),
      })),
      clients,
      spend: rubles(total?.spend ?? 0),
      leads: total?.leads ?? 0,
      buyers: total?.buyers ?? 0,
      revenue: rubles(total?.revenue ?? 0),
    };
  });

const utmSchema = z
  .string()
  .trim()
  .max(120)
  .transform((value) => normalizeUtm(value));

const directCampaignSchema = z
  .string()
  .trim()
  .regex(/^\d{0,15}$/, "ID кампании в Директе — только цифры")
  .transform((value) => (value ? Number(value) : null));

/**
 * Создаёт кампанию (без id) или сохраняет её. Метки приводятся к нижнему
 * регистру; utm_campaign без utm_source не бывает. Расходы из Директа
 * сразу пересчитываются за всю историю: по новой кампании Директа или,
 * если привязку сняли, удаляются.
 */
export const saveCampaign = adminProcedure
  .input(
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120),
      channel: z.enum(CHANNELS),
      utmSource: utmSchema,
      utmCampaign: utmSchema,
      directCampaignId: directCampaignSchema.optional(),
      notes: z
        .string()
        .trim()
        .max(2000)
        .transform((value) => value || null),
      archived: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, ...fields } = input;
    if (fields.utmCampaign && !fields.utmSource) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Укажите utm_source — utm_campaign без него не сработает",
      });
    }
    let saved: { id: string } | undefined;
    try {
      if (!id) {
        [saved] = await context.db
          .insert(adCampaigns)
          .values(fields)
          .returning({ id: adCampaigns.id });
        if (!saved) throw new Error("ad_campaign_insert_failed");
      } else {
        [saved] = await context.db
          .update(adCampaigns)
          .set(fields)
          .where(eq(adCampaigns.id, id))
          .returning({ id: adCampaigns.id });
        if (!saved) {
          throw new ORPCError("NOT_FOUND", { message: "Кампания не найдена" });
        }
      }
    } catch (error) {
      if (isUniqueViolation(error, "ad_campaigns_utm_idx")) {
        throw new ORPCError("CONFLICT", {
          message: "Кампания с такими метками уже заведена",
        });
      }
      if (isUniqueViolation(error, "ad_campaigns_direct_campaign_idx")) {
        throw new ORPCError("CONFLICT", {
          message: "Эта кампания Директа уже привязана к другой кампании",
        });
      }
      throw error;
    }
    await syncDirectExpenses(context.db, { campaignId: saved.id });
    return { id: saved.id };
  });

/**
 * Удаляет кампанию с её расходами. Клиенты с сайта вернутся к голой метке,
 * а у отмеченных вручную источник станет «не с рекламы».
 */
export const removeCampaign = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(adCampaigns)
      .where(eq(adCampaigns.id, input.id))
      .returning({ id: adCampaigns.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Кампания не найдена" });
    }
    return { id: removed.id };
  });

export const addExpense = adminProcedure
  .input(
    z.object({
      campaignId: z.string().min(1),
      spentOn: daySchema,
      amount: z.number().positive().max(21_474_836.47),
      note: z
        .string()
        .trim()
        .max(300)
        .transform((value) => value || null),
    }),
  )
  .handler(async ({ context, input }) => {
    const [campaignRow] = await context.db
      .select({ id: adCampaigns.id })
      .from(adCampaigns)
      .where(eq(adCampaigns.id, input.campaignId));
    if (!campaignRow) {
      throw new ORPCError("NOT_FOUND", { message: "Кампания не найдена" });
    }
    const [expense] = await context.db
      .insert(adExpenses)
      .values({ ...input, amount: toKopecks(input.amount) })
      .returning({ id: adExpenses.id });
    // Ручной расход за день вытесняет посчитанный по Директу
    await syncDirectExpenses(context.db, {
      campaignId: input.campaignId,
      from: input.spentOn,
      to: input.spentOn,
    });
    return { id: expense?.id };
  });

export const removeExpense = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select({ source: adExpenses.source })
      .from(adExpenses)
      .where(eq(adExpenses.id, input.id));
    if (row?.source === "yandex_direct") {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Расход из Директа пересчитывается сам — отвяжите кампанию Директа в настройках",
      });
    }
    const [removed] = await context.db
      .delete(adExpenses)
      .where(eq(adExpenses.id, input.id))
      .returning({
        id: adExpenses.id,
        campaignId: adExpenses.campaignId,
        spentOn: adExpenses.spentOn,
      });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Расход не найден" });
    }
    // Без ручного расхода день снова считается по Директу
    await syncDirectExpenses(context.db, {
      campaignId: removed.campaignId,
      from: removed.spentOn,
      to: removed.spentOn,
    });
    return { id: removed.id };
  });
