import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import {
  accessCodeAttempts,
  type CampaignAttribution,
  courseAccess,
  orders,
  type VisitorInfo,
  workshopAccessCodes,
} from "@stariva/db/schema";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";
import { earnsPreorderBonus } from "./preorder-bonus";

/** Неверных кодов с одного IP за час — дальше просим подождать. */
export const ACCESS_CODE_MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 60 * 60_000;

export type AccessCode = typeof workshopAccessCodes.$inferSelect;

export async function findAccessCode(code: string): Promise<AccessCode | null> {
  const [row] = await db
    .select()
    .from(workshopAccessCodes)
    .where(eq(workshopAccessCodes.code, code))
    .limit(1);
  return row ?? null;
}

/** Исчерпан ли предел неверных кодов. Сбой журнала активацию не блокирует. */
export async function isAccessCodeRateLimited(ip: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - FAILURE_WINDOW_MS);
    const [row] = await db
      .select({ n: count() })
      .from(accessCodeAttempts)
      .where(
        and(
          eq(accessCodeAttempts.ip, ip),
          gt(accessCodeAttempts.createdAt, since),
        ),
      );
    return (row?.n ?? 0) >= ACCESS_CODE_MAX_FAILURES;
  } catch (error) {
    console.error("[access-codes] Не удалось проверить предел:", error);
    return false;
  }
}

/** Записывает неверный код и заодно чистит записи старше суток. */
export async function recordAccessCodeFailure(ip: string): Promise<void> {
  try {
    await db.insert(accessCodeAttempts).values({ id: randomUUID(), ip });
    if (Math.random() < 0.05) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
      await db
        .delete(accessCodeAttempts)
        .where(lt(accessCodeAttempts.createdAt, dayAgo));
    }
  } catch (error) {
    console.error("[access-codes] Не удалось записать попытку:", error);
  }
}

/**
 * Откуда пришёл заказ: в отчётах по меткам он виден как продажа с Ярмарки.
 * Настоящих UTM у такого покупателя нет — он пришёл по коду из чата.
 */
function channelAttribution(channel: string): CampaignAttribution {
  const touch = {
    utm_source: channel,
    utm_medium: "marketplace",
    landing: "/code",
    at: new Date().toISOString(),
  };
  return { first: touch, last: touch };
}

function secretToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Активирует код одной транзакцией: гасит его, заводит оплаченный заказ на
 * цену из кода и открывает курс (и подарок за предзаказ, как при оплате на
 * сайте). Платежа ЮKassa у заказа нет — деньги получила площадка.
 * null — код успели активировать параллельно.
 */
export async function redeemAccessCode(input: {
  code: AccessCode;
  userId: string;
  email: string;
  releaseAt: Date | null;
  visitor: VisitorInfo | null;
}) {
  const { code } = input;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [claimed] = await tx
      .update(workshopAccessCodes)
      .set({ redeemedAt: now })
      .where(
        and(
          eq(workshopAccessCodes.id, code.id),
          isNull(workshopAccessCodes.redeemedAt),
        ),
      )
      .returning({ id: workshopAccessCodes.id });
    if (!claimed) return null;

    const [order] = await tx
      .insert(orders)
      .values({
        id: randomUUID(),
        userId: input.userId,
        workshopSlug: code.workshopSlug,
        amount: code.amount,
        currency: "RUB",
        status: "paid",
        createdAt: now,
        paidAt: now,
        contactEmail: input.email,
        accessToken: secretToken(),
        telegramToken: secretToken(),
        attribution: channelAttribution(code.channel),
        visitor: input.visitor,
      })
      .returning();
    if (!order) throw new Error("order_insert_failed");

    await tx
      .update(workshopAccessCodes)
      .set({ orderId: order.id })
      .where(eq(workshopAccessCodes.id, code.id));

    const bonus = earnsPreorderBonus({
      workshopSlug: code.workshopSlug,
      orderedAt: now,
      releaseAt: input.releaseAt,
    });
    const slugs = bonus ? [code.workshopSlug, bonus.slug] : [code.workshopSlug];
    await tx
      .insert(courseAccess)
      .values(
        slugs.map((workshopSlug) => ({
          id: randomUUID(),
          userId: input.userId,
          workshopSlug,
          orderId: order.id,
        })),
      )
      .onConflictDoNothing({
        target: [courseAccess.userId, courseAccess.workshopSlug],
      });

    return order;
  });
}
