import { logger } from "@stariva/config";
import { db } from "@stariva/db";
import {
  emailCampaignRecipients,
  emailCampaigns,
  emailLog,
  emailSuppressions,
} from "@stariva/db/schema";
import { campaignButtonUrl } from "@stariva/emails";
import { eq, sql } from "drizzle-orm";

/**
 * Пробное письмо из админки несёт токен test-<рассылка>: кнопка в нём ведёт
 * туда же, куда в настоящем, но ничего не засчитывается.
 */
const TEST_TOKEN = /^test-([0-9a-f-]{36})$/;
// Токены получателей — base64url; всё прочее в базу не несём
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

const r = emailCampaignRecipients;

/**
 * Строка журнала письма с этим токеном пикселя. Если строк несколько
 * (повторы одного письма рассылки, пробные письма) — последняя ушедшая.
 */
const loggedEmail = (token: string) =>
  eq(
    emailLog.id,
    sql`(select ${emailLog.id} from ${emailLog}
      where ${emailLog.openToken} = ${token} and ${emailLog.status} = 'sent'
      order by ${emailLog.createdAt} desc limit 1)`,
  );

/**
 * Открыли письмо: подгрузилась картинка-пиксель. Токен ищем и у получателей
 * рассылок, и в журнале писем: у рассылки он общий, у прочих писем — только
 * в журнале.
 */
export async function recordOpen(token: string): Promise<void> {
  // test-<рассылка> — пробное письмо и предпросмотр в админке: не считаем
  if (!TOKEN.test(token) || TEST_TOKEN.test(token)) return;
  // В одной транзакции: счётчики получателя и журнала не должны разойтись
  await db.transaction(async (tx) => {
    await tx
      .update(r)
      .set({
        openCount: sql`${r.openCount} + 1`,
        firstOpenedAt: sql`coalesce(${r.firstOpenedAt}, now())`,
      })
      .where(eq(r.token, token));
    await tx
      .update(emailLog)
      .set({
        openCount: sql`${emailLog.openCount} + 1`,
        firstOpenedAt: sql`coalesce(${emailLog.firstOpenedAt}, now())`,
      })
      .where(loggedEmail(token));
  });
}

/**
 * Нажали кнопку или другую ссылку письма (link — её имя в шаблоне):
 * засчитываем переход (и открытие — картинки могли быть выключены) и отдаём
 * её адрес. Переходы по всем ссылкам письма считаются вместе. null — токен
 * чужой или в рассылке нет такой ссылки.
 */
export async function recordClick(
  token: string,
  link?: string | null,
): Promise<string | null> {
  const columns = {
    template: emailCampaigns.template,
    params: emailCampaigns.params,
  };
  const test = TEST_TOKEN.exec(token);
  if (test) {
    const [campaign] = await db
      .select(columns)
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, test[1] as string))
      .limit(1);
    return campaign ? campaignButtonUrl(campaign, link) : null;
  }
  if (!TOKEN.test(token)) return null;
  const [campaign] = await db
    .select(columns)
    .from(r)
    .innerJoin(emailCampaigns, eq(emailCampaigns.id, r.campaignId))
    .where(eq(r.token, token))
    .limit(1);
  // Без кнопки в письме переходить было не по чему — такой переход не считаем
  const target = campaign ? campaignButtonUrl(campaign, link) : null;
  if (!target) return null;
  // Адрес уже известен: сбой счётчика не должен увести человека на главную
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(r)
        .set({
          clickCount: sql`${r.clickCount} + 1`,
          firstClickedAt: sql`coalesce(${r.firstClickedAt}, now())`,
          firstOpenedAt: sql`coalesce(${r.firstOpenedAt}, now())`,
        })
        .where(eq(r.token, token));
      // Нажал кнопку — значит, открыл, даже если картинки выключены
      await tx
        .update(emailLog)
        .set({ firstOpenedAt: sql`coalesce(${emailLog.firstOpenedAt}, now())` })
        .where(loggedEmail(token));
    });
  } catch (error) {
    logger.error("email_campaign.click_count_failed", error);
  }
  return target;
}

/** Адрес получателя по токену и отписан ли он уже — для страницы отписки. */
export async function findRecipient(
  token: string,
): Promise<{ email: string; unsubscribed: boolean } | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await db
    .select({ email: r.email, suppressedAt: emailSuppressions.createdAt })
    .from(r)
    .leftJoin(
      emailSuppressions,
      eq(emailSuppressions.email, sql`lower(${r.email})`),
    )
    .where(eq(r.token, token))
    .limit(1);
  return row
    ? { email: row.email, unsubscribed: row.suppressedAt !== null }
    : null;
}

/**
 * Отписывает адрес от всех рассылок. Повторная отписка ничего не меняет.
 * false — токен чужой.
 */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(r)
      .set({ unsubscribedAt: sql`coalesce(${r.unsubscribedAt}, now())` })
      .where(eq(r.token, token))
      .returning({ email: r.email, campaignId: r.campaignId });
    if (!row) return false;
    await tx
      .insert(emailSuppressions)
      .values({
        email: row.email.toLowerCase(),
        reason: "unsubscribed",
        campaignId: row.campaignId,
      })
      .onConflictDoNothing();
    return true;
  });
}
