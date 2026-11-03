import {
  and,
  type Database,
  type EmailCampaignSegment,
  emailSuppressions,
  eq,
  inArray,
  orders,
  sql,
  user,
  workshops,
} from "@stariva/db";

export interface AudienceMember {
  email: string;
  userId: string;
  /** Какие из курсов сегмента купил. */
  workshops: string[];
  /** Отписался или ящик не существует: рассылка ему не уйдёт. */
  suppressed: boolean;
}

// Адрес, на который покупатель получает письма о заказе: указанный при
// оплате, а если его нет — адрес аккаунта
const buyerEmail = sql<string>`lower(coalesce(${orders.contactEmail}, ${user.email}))`;
const paid = eq(orders.status, "paid");

/**
 * Кому уйдёт рассылка: по адресу на человека, отписавшиеся помечены. Список
 * считается заново при каждом вызове; при запуске рассылки он фиксируется.
 */
export async function loadAudience(
  db: Database,
  segment: EmailCampaignSegment,
): Promise<AudienceMember[]> {
  const rows = await db
    .select({
      email: buyerEmail,
      // Аккаунт последней покупки: у одного адреса их бывает несколько
      userId: sql<string>`(array_agg(${orders.userId} order by ${orders.paidAt} desc nulls last))[1]`,
      workshops: sql<string[]>`array_agg(distinct ${orders.workshopSlug})`,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(
        paid,
        segment.workshops.length > 0
          ? inArray(orders.workshopSlug, segment.workshops)
          : undefined,
      ),
    )
    .groupBy(buyerEmail)
    .orderBy(buyerEmail);
  if (rows.length === 0) return [];

  const suppressed = new Set(
    (
      await db
        .select({ email: emailSuppressions.email })
        .from(emailSuppressions)
        .where(
          inArray(
            emailSuppressions.email,
            rows.map((row) => row.email),
          ),
        )
    ).map((row) => row.email),
  );
  return rows.map((row) => ({ ...row, suppressed: suppressed.has(row.email) }));
}

/** Курсы, которые хоть кто-то оплатил, — для выбора сегмента. */
export async function purchasedWorkshops(db: Database) {
  return db
    .select({
      slug: orders.workshopSlug,
      title: sql<string>`coalesce(max(${workshops.title}), ${orders.workshopSlug})`,
      buyers: sql<number>`count(distinct ${buyerEmail})::int`,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug))
    .where(paid)
    .groupBy(orders.workshopSlug)
    .orderBy(orders.workshopSlug);
}
