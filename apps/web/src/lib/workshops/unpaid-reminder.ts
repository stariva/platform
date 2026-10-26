import { logger } from "@stariva/config";
import { db } from "@stariva/db";
import {
  courseAccess,
  orders,
  user,
  type WorkshopRow,
  workshopOrderNotifications,
  workshops,
} from "@stariva/db/schema";
import {
  StarivaWorkshopUnpaidEmail,
  sendEmail,
  workshopUnpaidEmailSubject,
} from "@stariva/emails";
import { and, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { WORKSHOP_PATH, WORKSHOP_SLUG } from "@/lib/elka/data";
import {
  claimOrderNotification,
  completeOrderNotification,
  getOrderById,
  releaseOrderNotification,
} from "@/lib/payments/orders";
import { formatPrice } from "@/lib/products";
import { formatReleaseDateTime } from "@/lib/workshops-data";
import { getBundle } from "./bundles";
import { siteUrl } from "./notifications";
import { syncPendingWorkshopOrder } from "./order-payment";
import { earnsPreorderBonus } from "./preorder-bonus";
import {
  dueUnpaidReminders,
  UNPAID_KIND,
  UNPAID_MAX_AGE_MS,
  type UnpaidCandidate,
} from "./unpaid-schedule";

/** Страница курса с кнопкой оплаты; метка — чтобы видеть, сколько вернуло письмо. */
function payUrl(slug: string, bundleSlug: string | null): string {
  const utm = "utm_source=email&utm_medium=reminder&utm_campaign=unpaid";
  const bundle = getBundle(bundleSlug);
  if (bundle) return `${siteUrl()}${bundle.path}?${utm}`;
  return slug === WORKSHOP_SLUG
    ? `${siteUrl()}${WORKSHOP_PATH}?${utm}#workshop`
    : `${siteUrl()}/workshops/${slug}?${utm}`;
}

function preorderInfo(workshop: WorkshopRow, now: Date) {
  if (!workshop.releaseAt || workshop.releaseAt <= now) return undefined;
  const price = workshop.price / 100;
  const regularPrice =
    workshop.priceAfterRelease === null ? 0 : workshop.priceAfterRelease / 100;
  const regular = regularPrice > price ? formatPrice(regularPrice) : undefined;
  // Подарок положен по моменту оформления — значит, оплатившему сейчас тоже
  const bonus = earnsPreorderBonus({
    workshopSlug: workshop.slug,
    orderedAt: now,
    releaseAt: workshop.releaseAt,
  });
  return {
    deadlineLabel: formatReleaseDateTime(workshop.releaseAt.toISOString()),
    priceLabel: formatPrice(price),
    regularPriceLabel: regular,
    bonus: bonus && { title: bonus.title, releaseLabel: bonus.releaseLabel },
  };
}

interface Candidate extends UnpaidCandidate {
  paymentId: string | null;
  bundleSlug: string | null;
  workshop: WorkshopRow;
}

/** Брошенные заказы за сутки по курсам, которые сейчас продаются. */
async function loadCandidates(now: Date): Promise<Candidate[]> {
  const email = sql<string>`lower(coalesce(${orders.contactEmail}, ${user.email}))`;
  const rows = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      workshopSlug: orders.workshopSlug,
      bundleSlug: orders.bundleSlug,
      status: orders.status,
      createdAt: orders.createdAt,
      paymentId: orders.paymentId,
      email,
      workshop: workshops,
    })
    .from(orders)
    .innerJoin(workshops, eq(workshops.slug, orders.workshopSlug))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(
        inArray(orders.status, ["pending", "canceled"]),
        gte(orders.createdAt, new Date(now.getTime() - UNPAID_MAX_AGE_MS)),
        eq(workshops.status, "published"),
      ),
    );
  return rows.filter((row) => row.workshop.price > 0);
}

/**
 * Кто уже владеет курсом: оплатил любым заказом (по аккаунту или по email —
 * мог заплатить с другой почты в аккаунте) или получил доступ иначе.
 * Сверяем и старые pending-заказы; при сбое тоже откладываем письмо.
 */
async function loadOwners(candidates: Candidate[]) {
  const slugs = [...new Set(candidates.map((c) => c.workshopSlug))];
  const userIds = [...new Set(candidates.map((c) => c.userId))];
  const emails = [...new Set(candidates.map((c) => c.email))];
  const paidEmail = sql<string>`lower(coalesce(${orders.contactEmail}, ${user.email}))`;
  const [related, access] = await Promise.all([
    db
      .select({
        order: orders,
        email: paidEmail,
      })
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .where(
        and(
          or(
            eq(orders.status, "paid"),
            and(eq(orders.status, "pending"), isNotNull(orders.paymentId)),
          ),
          inArray(orders.workshopSlug, slugs),
          or(inArray(orders.userId, userIds), inArray(paidEmail, emails)),
        ),
      ),
    db
      .select({ userId: courseAccess.userId, slug: courseAccess.workshopSlug })
      .from(courseAccess)
      .where(
        and(
          inArray(courseAccess.workshopSlug, slugs),
          inArray(courseAccess.userId, userIds),
        ),
      ),
  ]);
  const owned = new Set<string>();
  for (const row of related) {
    if (row.order.status === "pending") {
      if (await syncPendingWorkshopOrder(row.order)) {
        const fresh = await getOrderById(row.order.id);
        if (fresh && fresh.status !== "paid") continue;
      }
    }
    owned.add(`user:${row.order.userId}:${row.order.workshopSlug}`);
    owned.add(`email:${row.email}:${row.order.workshopSlug}`);
  }
  for (const row of access) owned.add(`user:${row.userId}:${row.slug}`);
  return (c: UnpaidCandidate) =>
    owned.has(`user:${c.userId}:${c.workshopSlug}`) ||
    owned.has(`email:${c.email}:${c.workshopSlug}`);
}

async function loadReminded(candidates: Candidate[]) {
  const email = sql<string>`lower(coalesce(${orders.contactEmail}, ${user.email}))`;
  const rows = await db
    .select({ userId: orders.userId, slug: orders.workshopSlug, email })
    .from(workshopOrderNotifications)
    .innerJoin(orders, eq(orders.id, workshopOrderNotifications.orderId))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(
        inArray(
          orders.workshopSlug,
          candidates.map((c) => c.workshopSlug),
        ),
        or(
          inArray(
            orders.userId,
            candidates.map((c) => c.userId),
          ),
          inArray(
            email,
            candidates.map((c) => c.email),
          ),
        ),
        eq(workshopOrderNotifications.kind, UNPAID_KIND),
        eq(workshopOrderNotifications.channel, "email"),
        isNotNull(workshopOrderNotifications.sentAt),
      ),
    );
  const reminded = new Set<string>();
  for (const row of rows) {
    reminded.add(`user:${row.userId}:${row.slug}`);
    reminded.add(`email:${row.email}:${row.slug}`);
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return (orderId: string) => {
    const candidate = byId.get(orderId);
    return (
      !!candidate &&
      (reminded.has(`user:${candidate.userId}:${candidate.workshopSlug}`) ||
        reminded.has(`email:${candidate.email}:${candidate.workshopSlug}`))
    );
  };
}

/**
 * Вебхук мог потеряться: платёж прошёл, а заказ всё ещё pending. Спрашиваем
 * YooKassa перед письмом, чтобы не написать «оплата не завершилась» тому,
 * кто заплатил.
 */
async function stillUnpaid(candidate: Candidate): Promise<boolean> {
  if (candidate.status !== "pending" || !candidate.paymentId) return true;
  const order = await getOrderById(candidate.id);
  if (!order) return false;
  if (!(await syncPendingWorkshopOrder(order))) return false;
  const fresh = await getOrderById(candidate.id);
  return fresh?.status === "pending" || fresh?.status === "canceled";
}

async function deliver(candidate: Candidate, now: Date): Promise<boolean> {
  if (!(await stillUnpaid(candidate))) return false;
  const claimId = await claimOrderNotification(
    candidate.id,
    UNPAID_KIND,
    "email",
  );
  if (!claimId) return false;
  const { workshop } = candidate;
  try {
    await sendEmail({
      idempotencyKey: `workshop:${candidate.id}:${UNPAID_KIND}:email`,
      to: [candidate.email],
      subject: workshopUnpaidEmailSubject({ workshopTitle: workshop.title }),
      react: StarivaWorkshopUnpaidEmail({
        workshopTitle: workshop.title,
        payUrl: payUrl(workshop.slug, candidate.bundleSlug),
        preorder: preorderInfo(workshop, now),
      }),
    });
    await completeOrderNotification(claimId);
    return true;
  } catch (error) {
    await releaseOrderNotification(claimId);
    throw error;
  }
}

/**
 * Одно письмо «оплата не завершилась» тем, кто оформил мастер-класс, но не
 * оплатил: через час после оформления, если курс так и не куплен. Идёт в
 * общем прогоне напоминаний; повтор безопасен — отправленное помечено в
 * workshop_order_notifications (kind = unpaid).
 */
export async function runUnpaidOrderSweep(now = new Date()) {
  const candidates = await loadCandidates(now);
  if (candidates.length === 0) return { checked: 0, delivered: 0, failed: 0 };

  const [owns, reminded] = await Promise.all([
    loadOwners(candidates),
    loadReminded(candidates),
  ]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const due = dueUnpaidReminders(candidates, { owns, reminded, now });

  let delivered = 0;
  let failed = 0;
  for (const { id } of due) {
    const candidate = byId.get(id);
    if (!candidate) continue;
    try {
      if (await deliver(candidate, now)) delivered++;
    } catch (error) {
      failed++;
      logger.error("workshop.unpaid_reminder.failed", error, { orderId: id });
    }
  }
  return { checked: candidates.length, delivered, failed };
}
