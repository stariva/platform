import { db } from "@stariva/db";
import {
  emailCampaignRecipients,
  emailCampaigns,
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

/** Открыли письмо: подгрузилась картинка-пиксель. */
export async function recordOpen(token: string): Promise<void> {
  if (!TOKEN.test(token)) return;
  await db
    .update(r)
    .set({
      openCount: sql`${r.openCount} + 1`,
      firstOpenedAt: sql`coalesce(${r.firstOpenedAt}, now())`,
    })
    .where(eq(r.token, token));
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
  await db
    .update(r)
    .set({
      clickCount: sql`${r.clickCount} + 1`,
      firstClickedAt: sql`coalesce(${r.firstClickedAt}, now())`,
      firstOpenedAt: sql`coalesce(${r.firstOpenedAt}, now())`,
    })
    .where(eq(r.token, token));
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
