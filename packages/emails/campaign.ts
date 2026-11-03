import { render } from "@react-email/components";
import { logger } from "@stariva/config";
import {
  and,
  type Database,
  db as defaultDb,
  type EmailCampaignRow,
  type EmailCampaignSegment,
  emailCampaignRecipients,
  emailCampaigns,
  emailSuppressions,
  eq,
  inArray,
  isNull,
  lt,
  notExists,
  or,
  sql,
} from "@stariva/db";

import StarivaCampaignEmail from "./emails/stariva-campaign";
import { env } from "./env";
import { errorText } from "./log-row";
import { isEmailConfigured } from "./providers";
import { sendEmail } from "./send";

/** Столько раз пробуем отправить письмо одному получателю, потом сдаёмся. */
export const CAMPAIGN_MAX_ATTEMPTS = 3;
// Аренда на одно письмо: у каждого провайдера таймаут 30 секунд, их два
const LEASE_MS = 5 * 60 * 1000;
// Не ушло — следующая попытка не раньше, чем через столько
const RETRY_DELAY_MS = 10 * 60 * 1000;
// Пауза между письмами, чтобы не упереться в лимит провайдера
const SEND_INTERVAL_MS = 200;

type CampaignContent = Pick<
  EmailCampaignRow,
  | "subject"
  | "previewText"
  | "heading"
  | "body"
  | "buttonLabel"
  | "buttonUrl"
  | "segment"
>;

/**
 * Ссылки письма для одного получателя. Все ведут на сайт: он засчитывает
 * открытие и переход и только потом отправляет дальше.
 */
export function campaignLinks(siteUrl: string, token: string) {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    open: `${base}/api/m/o/${token}`,
    click: `${base}/api/m/c/${token}`,
    /** Страница с кнопкой «Отписаться»: сама ссылка ничего не меняет. */
    unsubscribe: `${base}/unsubscribe/${token}`,
    /** Отписка в один клик из почтовика (RFC 8058), только POST. */
    oneClick: `${base}/api/m/u/${token}`,
  };
}

/** Почему адресату пришло письмо — строчка внизу письма. */
export function campaignReason(segment: EmailCampaignSegment): string {
  switch (segment.type) {
    case "workshop_buyers":
      return "Письмо пришло, потому что вы купили мастер-класс на stariva.ru.";
  }
}

/** Тема, тело и заголовки письма рассылки для одного получателя. */
export function campaignEmail(
  campaign: CampaignContent,
  { siteUrl, token }: { siteUrl: string; token: string },
) {
  const links = campaignLinks(siteUrl, token);
  const hasButton = Boolean(campaign.buttonLabel && campaign.buttonUrl);
  return {
    subject: campaign.subject,
    react: StarivaCampaignEmail({
      previewText: campaign.previewText,
      heading: campaign.heading,
      body: campaign.body,
      buttonLabel: hasButton ? campaign.buttonLabel : null,
      buttonUrl: hasButton ? links.click : null,
      reason: campaignReason(campaign.segment),
      unsubscribeUrl: links.unsubscribe,
      openPixelUrl: links.open,
    }),
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** HTML письма для предпросмотра в админке: ссылки как в пробном письме. */
export function renderCampaignHtml(
  campaign: CampaignContent & { id: string },
  siteUrl: string,
): Promise<string> {
  return render(
    campaignEmail(campaign, { siteUrl, token: `test-${campaign.id}` }).react,
  );
}

/**
 * Пробное письмо рассылки себе. Токен test-<рассылка>: кнопка ведёт туда же,
 * куда в настоящем письме, но переход и отписка ничего не засчитают.
 */
export async function sendCampaignTest(
  campaign: CampaignContent & { id: string },
  { to, siteUrl }: { to: string; siteUrl: string },
): Promise<void> {
  if (!env.EMAIL_SANDBOX_ENABLED && !isEmailConfigured()) {
    throw new Error("email_not_configured");
  }
  const email = campaignEmail(campaign, {
    siteUrl,
    token: `test-${campaign.id}`,
  });
  await sendEmail({ ...email, subject: `[Тест] ${email.subject}`, to: [to] });
}

export interface CampaignBatchResult {
  sent: number;
  failed: number;
  skipped: number;
}

const r = emailCampaignRecipients;

/** Получатели, которым пора отправить: впервые или повторно после сбоя. */
function dueRecipients(now: Date, campaignId?: string) {
  return and(
    eq(emailCampaigns.status, "sending"),
    or(
      eq(r.status, "queued"),
      and(eq(r.status, "failed"), lt(r.attempts, CAMPAIGN_MAX_ATTEMPTS)),
    ),
    or(isNull(r.leaseUntil), lt(r.leaseUntil, now)),
    campaignId ? eq(r.campaignId, campaignId) : undefined,
  );
}

/**
 * Берёт в аренду одного получателя, которому пора отправить. Аренда — на
 * одно письмо: пока оно уходит, другой прогон этого получателя не возьмёт.
 */
async function claimRecipient(db: Database, campaignId?: string) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const [recipient] = await db
    .update(r)
    .set({ leaseUntil })
    .where(
      inArray(
        r.id,
        db
          .select({ id: r.id })
          .from(r)
          .innerJoin(emailCampaigns, eq(emailCampaigns.id, r.campaignId))
          .where(dueRecipients(now, campaignId))
          .orderBy(r.createdAt, r.id)
          .limit(1)
          .for("update", { of: r, skipLocked: true }),
      ),
    )
    .returning();
  return recipient ? { recipient, leaseUntil } : null;
}

/**
 * Отправляет письма рассылок, которые сейчас идут (status = sending), по
 * одному: аренда получателя, проверка отписки, отправка, итог. Итог пишется,
 * только пока аренда наша, а попытка засчитывается, когда отправка
 * закончилась, — оборванная на полпути не съедает попытку. Останавливается
 * на `limit` письмах или к `deadline`. Рассылку, которой больше некому
 * слать, помечает отправленной.
 */
export async function sendCampaignBatch({
  db = defaultDb,
  siteUrl,
  campaignId,
  limit = 50,
  deadline,
}: {
  db?: Database;
  siteUrl: string;
  campaignId?: string;
  limit?: number;
  /** Время (мс), после которого новое письмо уже не начинаем. */
  deadline?: number;
}): Promise<CampaignBatchResult> {
  const result: CampaignBatchResult = { sent: 0, failed: 0, skipped: 0 };
  if (!env.EMAIL_SANDBOX_ENABLED && !isEmailConfigured()) {
    throw new Error("email_not_configured");
  }
  const campaigns = new Map<string, EmailCampaignRow>();

  for (let handled = 0; handled < limit; handled++) {
    if (deadline !== undefined && Date.now() >= deadline) break;
    const claim = await claimRecipient(db, campaignId);
    if (!claim) break;
    const { recipient, leaseUntil } = claim;
    const ours = and(eq(r.id, recipient.id), eq(r.leaseUntil, leaseUntil));

    let campaign = campaigns.get(recipient.campaignId);
    if (!campaign) {
      [campaign] = await db
        .select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, recipient.campaignId));
      if (!campaign) continue;
      campaigns.set(campaign.id, campaign);
    }

    // Мог отписаться уже после запуска, в том числе пока уходили другие письма
    const [suppressed] = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, recipient.email.toLowerCase()));
    if (suppressed) {
      await db
        .update(r)
        .set({ status: "skipped", leaseUntil: null })
        .where(ours);
      result.skipped++;
      continue;
    }

    if (result.sent + result.failed > 0) {
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
    let sendError: unknown = null;
    try {
      await sendEmail({
        ...campaignEmail(campaign, { siteUrl, token: recipient.token }),
        to: [recipient.email],
        idempotencyKey: `campaign:${campaign.id}:${recipient.id}`,
      });
    } catch (error) {
      sendError = error;
    }

    if (sendError === null) {
      // Письмо уже принято: сбой записи не должен превратиться в «не ушло» с
      // повтором — Postbox дубль не отсечёт. Поэтому запись пробуем ещё раз,
      // а не дойдя — бросаем: строка останется под арендой, и повтор будет
      // только после её истечения
      await withRetry(() =>
        db
          .update(r)
          .set({
            status: "sent",
            sentAt: new Date(),
            error: null,
            attempts: sql`${r.attempts} + 1`,
            leaseUntil: null,
          })
          .where(ours),
      );
      result.sent++;
      continue;
    }

    logger.error("email_campaign.send_failed", sendError, {
      campaignId: campaign.id,
      recipientId: recipient.id,
    });
    await db
      .update(r)
      .set({
        status: "failed",
        error: errorText(sendError),
        attempts: sql`${r.attempts} + 1`,
        leaseUntil: new Date(Date.now() + RETRY_DELAY_MS),
      })
      .where(ours);
    result.failed++;
  }

  await finishCampaigns(db, new Date());
  return result;
}

/** Три попытки с паузой в секунду: переждать короткий сбой базы. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/** Рассылки, где не осталось ни очереди, ни писем на повтор, — отправлены. */
async function finishCampaigns(db: Database, now: Date) {
  await db
    .update(emailCampaigns)
    .set({ status: "sent", finishedAt: now })
    .where(
      and(
        eq(emailCampaigns.status, "sending"),
        notExists(
          db
            .select({ one: sql`1` })
            .from(r)
            .where(
              and(
                eq(r.campaignId, emailCampaigns.id),
                or(
                  eq(r.status, "queued"),
                  and(
                    eq(r.status, "failed"),
                    lt(r.attempts, CAMPAIGN_MAX_ATTEMPTS),
                  ),
                ),
              ),
            ),
        ),
      ),
    );
}
