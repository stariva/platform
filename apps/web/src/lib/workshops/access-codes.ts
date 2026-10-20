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
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
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

/** Резервирует попытку до проверки кода. null — предел или сбой БД. */
export async function reserveAccessCodeAttempt(
  ip: string,
): Promise<string | null> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`access-code:${ip}`}, 0))`,
      );
      const since = new Date(Date.now() - FAILURE_WINDOW_MS);
      const [row] = await tx
        .select({ n: count() })
        .from(accessCodeAttempts)
        .where(
          and(
            eq(accessCodeAttempts.ip, ip),
            gt(accessCodeAttempts.createdAt, since),
          ),
        );
      if ((row?.n ?? 0) >= ACCESS_CODE_MAX_FAILURES) return null;

      const attemptId = randomUUID();
      await tx.insert(accessCodeAttempts).values({ id: attemptId, ip });
      if (Math.random() < 0.05) {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
        await tx
          .delete(accessCodeAttempts)
          .where(lt(accessCodeAttempts.createdAt, dayAgo));
      }
      return attemptId;
    });
  } catch (error) {
    console.error("[access-codes] Не удалось зарезервировать попытку:", error);
    return null;
  }
}

/** Успешная активация не расходует предел неверных кодов. */
export async function releaseAccessCodeAttempt(
  attemptId: string,
): Promise<void> {
  try {
    await db
      .delete(accessCodeAttempts)
      .where(eq(accessCodeAttempts.id, attemptId));
  } catch (error) {
    console.error("[access-codes] Не удалось удалить успешную попытку:", error);
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

    const [access] = await tx
      .insert(courseAccess)
      .values({
        id: randomUUID(),
        userId: input.userId,
        workshopSlug: code.workshopSlug,
        orderId: order.id,
      })
      .onConflictDoNothing({
        target: [courseAccess.userId, courseAccess.workshopSlug],
      })
      .returning({ id: courseAccess.id });
    if (!access) throw new Error("course_already_owned");

    const bonus = earnsPreorderBonus({
      workshopSlug: code.workshopSlug,
      orderedAt: now,
      releaseAt: input.releaseAt,
    });
    if (bonus) {
      await tx
        .insert(courseAccess)
        .values({
          id: randomUUID(),
          userId: input.userId,
          workshopSlug: bonus.slug,
          orderId: order.id,
        })
        .onConflictDoNothing({
          target: [courseAccess.userId, courseAccess.workshopSlug],
        });
    }

    return order;
  });
}
