import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { env } from "@stariva/config";
import {
  and,
  asc,
  type Database,
  desc,
  emailCampaignRecipients,
  emailCampaigns,
  eq,
  sql,
} from "@stariva/db";
import {
  renderCampaignHtml,
  sendCampaignBatch,
  sendCampaignTest,
} from "@stariva/emails";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadAudience, purchasedWorkshops } from "./audience";

/** Куда ведут ссылки письма, если адрес витрины не задан. */
const DEFAULT_STOREFRONT_URL = "https://stariva.ru";
const siteUrl = () => env.STOREFRONT_URL ?? DEFAULT_STOREFRONT_URL;

// Столько админка ждёт отправку сама; остаток дошлёт крон сайта
const START_BUDGET_MS = 40_000;

const idInput = z.object({ id: z.string().uuid() });

const segmentSchema = z.object({
  type: z.literal("workshop_buyers"),
  workshops: z.array(z.string().trim().min(1).max(100)).max(50),
});

const contentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(200),
    previewText: z.string().trim().max(200),
    heading: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10_000),
    buttonLabel: z.string().trim().max(60),
    buttonUrl: z.union([
      z.literal(""),
      z.url({ protocol: /^https?$/ }).max(2000),
    ]),
    segment: segmentSchema,
  })
  .refine((value) => !value.buttonLabel === !value.buttonUrl, {
    message: "Укажите и текст кнопки, и ссылку — или оставьте оба поля пустыми",
    path: ["buttonUrl"],
  });

const r = emailCampaignRecipients;

/** Счётчики рассылки по её получателям. */
const statsColumns = {
  recipients: sql<number>`count(${r.id})::int`,
  queued: sql<number>`(count(*) filter (where ${r.status} = 'queued'))::int`,
  sent: sql<number>`(count(*) filter (where ${r.status} = 'sent'))::int`,
  failed: sql<number>`(count(*) filter (where ${r.status} = 'failed'))::int`,
  skipped: sql<number>`(count(*) filter (where ${r.status} = 'skipped'))::int`,
  opened: sql<number>`(count(*) filter (where ${r.firstOpenedAt} is not null))::int`,
  clicked: sql<number>`(count(*) filter (where ${r.firstClickedAt} is not null))::int`,
  unsubscribed: sql<number>`(count(*) filter (where ${r.unsubscribedAt} is not null))::int`,
};

async function findCampaign(db: Database, id: string) {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, id))
    .limit(1);
  if (!campaign) throw new ORPCError("NOT_FOUND");
  return campaign;
}

/**
 * Рассылки, свежие сверху, со счётчиками: скольким ушло, сколько открыли,
 * перешли по кнопке и отписались.
 */
const list = adminProcedure.handler(async ({ context }) =>
  context.db
    .select({
      id: emailCampaigns.id,
      name: emailCampaigns.name,
      subject: emailCampaigns.subject,
      status: emailCampaigns.status,
      createdAt: emailCampaigns.createdAt,
      startedAt: emailCampaigns.startedAt,
      finishedAt: emailCampaigns.finishedAt,
      ...statsColumns,
    })
    .from(emailCampaigns)
    .leftJoin(r, eq(r.campaignId, emailCampaigns.id))
    .groupBy(emailCampaigns.id)
    .orderBy(desc(emailCampaigns.createdAt)),
);

/** Рассылка, её счётчики и все получатели с тем, что о них известно. */
const get = adminProcedure
  .input(idInput)
  .handler(async ({ context, input }) => {
    const campaign = await findCampaign(context.db, input.id);
    const [stats, recipients] = await Promise.all([
      context.db
        .select(statsColumns)
        .from(r)
        .where(eq(r.campaignId, input.id))
        .then((rows) => rows[0]),
      context.db
        .select({
          id: r.id,
          email: r.email,
          status: r.status,
          error: r.error,
          attempts: r.attempts,
          sentAt: r.sentAt,
          firstOpenedAt: r.firstOpenedAt,
          openCount: r.openCount,
          firstClickedAt: r.firstClickedAt,
          clickCount: r.clickCount,
          unsubscribedAt: r.unsubscribedAt,
        })
        .from(r)
        .where(eq(r.campaignId, input.id))
        .orderBy(asc(r.email)),
    ]);
    return { campaign, stats, recipients };
  });

/**
 * Кому уйдёт рассылка с таким сегментом — до запуска, чтобы проверить
 * список. Заодно курсы, из которых можно выбрать.
 */
const audience = adminProcedure
  .input(z.object({ segment: segmentSchema }))
  .handler(async ({ context, input }) => {
    const [members, workshops] = await Promise.all([
      loadAudience(context.db, input.segment),
      purchasedWorkshops(context.db),
    ]);
    return { members, workshops };
  });

/** Новая рассылка (без id) или правка черновика. Запущенную менять нельзя. */
const save = adminProcedure
  .input(
    z.intersection(
      contentSchema,
      z.object({ id: z.string().uuid().optional() }),
    ),
  )
  .handler(async ({ context, input }) => {
    const { id, ...content } = input;
    const values = {
      ...content,
      buttonLabel: content.buttonLabel || null,
      buttonUrl: content.buttonUrl || null,
    };
    if (!id) {
      const [created] = await context.db
        .insert(emailCampaigns)
        .values(values)
        .returning({ id: emailCampaigns.id });
      return { id: (created as { id: string }).id };
    }
    const [updated] = await context.db
      .update(emailCampaigns)
      .set(values)
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.status, "draft")))
      .returning({ id: emailCampaigns.id });
    if (!updated) {
      throw new ORPCError("CONFLICT", {
        message: "Рассылка уже запущена, её не изменить",
      });
    }
    return { id };
  });

/** Удаляет черновик. Запущенная рассылка остаётся: в ней история отправки. */
const remove = adminProcedure
  .input(idInput)
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(emailCampaigns)
      .where(
        and(
          eq(emailCampaigns.id, input.id),
          eq(emailCampaigns.status, "draft"),
        ),
      )
      .returning({ id: emailCampaigns.id });
    if (!removed) {
      throw new ORPCError("CONFLICT", {
        message: "Удалить можно только черновик",
      });
    }
  });

/** HTML письма, как его увидит получатель. */
const preview = adminProcedure
  .input(idInput)
  .handler(async ({ context, input }) => {
    const campaign = await findCampaign(context.db, input.id);
    return { html: await renderCampaignHtml(campaign, siteUrl()) };
  });

/** Пробное письмо себе (на почту админа) или на указанный адрес. */
const sendTest = adminProcedure
  .input(idInput.extend({ to: z.email().optional() }))
  .handler(async ({ context, input }) => {
    const campaign = await findCampaign(context.db, input.id);
    const to = input.to ?? context.session.user.email;
    await sendCampaignTest(campaign, { to, siteUrl: siteUrl() });
    return { to };
  });

/**
 * Запускает рассылку: фиксирует получателей (без отписавшихся) и сразу
 * отправляет, сколько успеет за START_BUDGET_MS. Остаток и повторы после
 * сбоев дошлёт крон сайта.
 */
const start = adminProcedure
  .input(idInput)
  .handler(async ({ context, input }) => {
    // Черновик заперт до конца транзакции: сохранение из другой вкладки
    // дождётся запуска и получит отказ, а получатели возьмутся из того
    // сегмента, что в базе
    const recipients = await context.db.transaction(async (tx) => {
      const [campaign] = await tx
        .select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, input.id))
        .for("update");
      if (!campaign) throw new ORPCError("NOT_FOUND");
      if (campaign.status !== "draft") {
        throw new ORPCError("CONFLICT", { message: "Рассылка уже запущена" });
      }
      const members = (
        await loadAudience(tx as unknown as Database, campaign.segment)
      ).filter((member) => !member.suppressed);
      if (members.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Некому отправлять: в сегменте никого нет",
        });
      }
      await tx
        .update(emailCampaigns)
        .set({ status: "sending", startedAt: new Date() })
        .where(eq(emailCampaigns.id, campaign.id));
      await tx
        .insert(r)
        .values(
          members.map((member) => ({
            campaignId: campaign.id,
            email: member.email,
            userId: member.userId,
            token: randomBytes(18).toString("base64url"),
          })),
        )
        .onConflictDoNothing();
      return members.length;
    });

    const totals = await sendCampaignBatch({
      db: context.db,
      siteUrl: siteUrl(),
      campaignId: input.id,
      limit: recipients,
      deadline: Date.now() + START_BUDGET_MS,
    });
    return { recipients, ...totals };
  });

export const adminCampaignsRouter = {
  list,
  get,
  audience,
  save,
  remove,
  preview,
  sendTest,
  start,
};
