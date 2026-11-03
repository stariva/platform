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
// Дольше одна отправка не длится: у каждого провайдера таймаут 30 секунд
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

/** Получатели, которым пора отправить: впервые или повторно после сбоя. */
function dueRecipients(now: Date, campaignId?: string) {
  const r = emailCampaignRecipients;
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
 * Отправляет очередную порцию писем рассылок, которые сейчас идут
 * (status = sending). Получателя сначала берёт в аренду, поэтому два
 * параллельных прогона — из админки и крона — письмо не задвоят. Рассылку,
 * которой больше некому слать, помечает отправленной.
 */
export async function sendCampaignBatch({
  db = defaultDb,
  siteUrl,
  campaignId,
  limit = 50,
  now = new Date(),
}: {
  db?: Database;
  siteUrl: string;
  campaignId?: string;
  limit?: number;
  now?: Date;
}): Promise<CampaignBatchResult> {
  const result: CampaignBatchResult = { sent: 0, failed: 0, skipped: 0 };
  if (!env.EMAIL_SANDBOX_ENABLED && !isEmailConfigured()) {
    throw new Error("email_not_configured");
  }
  const r = emailCampaignRecipients;

  const claimed = await db
    .update(r)
    .set({
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      attempts: sql`${r.attempts} + 1`,
    })
    .where(
      inArray(
        r.id,
        db
          .select({ id: r.id })
          .from(r)
          .innerJoin(emailCampaigns, eq(emailCampaigns.id, r.campaignId))
          .where(dueRecipients(now, campaignId))
          .orderBy(r.createdAt, r.id)
          .limit(limit)
          .for("update", { of: r, skipLocked: true }),
      ),
    )
    .returning();

  if (claimed.length > 0) {
    const campaigns = new Map(
      (
        await db
          .select()
          .from(emailCampaigns)
          .where(
            inArray(emailCampaigns.id, [
              ...new Set(claimed.map((row) => row.campaignId)),
            ]),
          )
      ).map((campaign) => [campaign.id, campaign]),
    );
    // Мог отписаться уже после запуска — например, из другой рассылки
    const suppressed = new Set(
      (
        await db
          .select({ email: emailSuppressions.email })
          .from(emailSuppressions)
          .where(
            inArray(
              emailSuppressions.email,
              claimed.map((row) => row.email.toLowerCase()),
            ),
          )
      ).map((row) => row.email),
    );

    for (const [index, recipient] of claimed.entries()) {
      const campaign = campaigns.get(recipient.campaignId);
      if (!campaign) continue;
      if (suppressed.has(recipient.email.toLowerCase())) {
        await db
          .update(r)
          .set({ status: "skipped", leaseUntil: null })
          .where(eq(r.id, recipient.id));
        result.skipped++;
        continue;
      }
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
      }
      try {
        await sendEmail({
          ...campaignEmail(campaign, { siteUrl, token: recipient.token }),
          to: [recipient.email],
          idempotencyKey: `campaign:${campaign.id}:${recipient.id}`,
        });
        await db
          .update(r)
          .set({
            status: "sent",
            sentAt: new Date(),
            error: null,
            leaseUntil: null,
          })
          .where(eq(r.id, recipient.id));
        result.sent++;
      } catch (error) {
        logger.error("email_campaign.send_failed", error, {
          campaignId: campaign.id,
          recipientId: recipient.id,
        });
        await db
          .update(r)
          .set({
            status: "failed",
            error: errorText(error),
            leaseUntil: new Date(Date.now() + RETRY_DELAY_MS),
          })
          .where(eq(r.id, recipient.id));
        result.failed++;
      }
    }
  }

  await finishCampaigns(db, now);
  return result;
}

/** Рассылки, где не осталось ни очереди, ни писем на повтор, — отправлены. */
async function finishCampaigns(db: Database, now: Date) {
  const r = emailCampaignRecipients;
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
