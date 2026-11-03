import {
  courseAccess,
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

/**
 * Оплаченные заказы мастер-классов: адрес покупателя и все курсы, которые
 * дал заказ. У комбо в заказе записан только основной курс, остальные
 * выданы доступом по тому же заказу.
 */
function paidPurchases(db: Database) {
  return db
    .select({
      // Адрес, на который покупатель получает письма о заказе: указанный при
      // оплате, а если его нет — адрес аккаунта
      email: sql<string>`lower(coalesce(${orders.contactEmail}, ${user.email}))`,
      userId: orders.userId,
      paidAt: orders.paidAt,
      workshops: sql<string[]>`array(
        select ${orders.workshopSlug}
        union
        select ${courseAccess.workshopSlug} from ${courseAccess}
        where ${courseAccess.orderId} = ${orders.id}
      )`,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .where(eq(orders.status, "paid"));
}

/**
 * Кому уйдёт рассылка: по адресу на человека, отписавшиеся помечены. Список
 * считается заново при каждом вызове; при запуске рассылки он фиксируется.
 */
export async function loadAudience(
  db: Database,
  segment: EmailCampaignSegment,
): Promise<AudienceMember[]> {
  const wanted = new Set(segment.workshops);
  const members = new Map<
    string,
    { userId: string; paidAt: number; workshops: Set<string> }
  >();
  for (const purchase of await paidPurchases(db)) {
    const matched = purchase.workshops.filter(
      (slug) => wanted.size === 0 || wanted.has(slug),
    );
    if (matched.length === 0) continue;
    const paidAt = purchase.paidAt?.getTime() ?? 0;
    const member = members.get(purchase.email);
    if (!member) {
      members.set(purchase.email, {
        userId: purchase.userId,
        paidAt,
        workshops: new Set(matched),
      });
      continue;
    }
    // Аккаунт последней покупки: у одного адреса их бывает несколько
    if (paidAt > member.paidAt) {
      member.userId = purchase.userId;
      member.paidAt = paidAt;
    }
    for (const slug of matched) member.workshops.add(slug);
  }
  if (members.size === 0) return [];

  const suppressed = new Set(
    (
      await db
        .select({ email: emailSuppressions.email })
        .from(emailSuppressions)
        .where(inArray(emailSuppressions.email, [...members.keys()]))
    ).map((row) => row.email),
  );
  return [...members.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, member]) => ({
      email,
      userId: member.userId,
      workshops: [...member.workshops].sort(),
      suppressed: suppressed.has(email),
    }));
}

/** Курсы, которые хоть кто-то оплатил (и в комбо тоже), — для выбора сегмента. */
export async function purchasedWorkshops(db: Database) {
  const buyers = new Map<string, Set<string>>();
  for (const purchase of await paidPurchases(db)) {
    for (const slug of purchase.workshops) {
      const emails = buyers.get(slug) ?? new Set<string>();
      emails.add(purchase.email);
      buyers.set(slug, emails);
    }
  }
  if (buyers.size === 0) return [];
  const titles = new Map(
    (
      await db
        .select({ slug: workshops.slug, title: workshops.title })
        .from(workshops)
        .where(inArray(workshops.slug, [...buyers.keys()]))
    ).map((row) => [row.slug, row.title]),
  );
  return [...buyers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, emails]) => ({
      slug,
      title: titles.get(slug) ?? slug,
      buyers: emails.size,
    }));
}
