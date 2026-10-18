/**
 * Письмо «оплата не завершилась»: кому из начавших оформление его пора
 * отправить. Только отбор, без базы и почты — их делает unpaid-reminder.ts.
 */

const HOUR = 3600 * 1000;

/** Сколько ждать после оформления: человек мог просто долго платить. */
export const UNPAID_DELAY_MS = HOUR;
/** Старше суток не пишем: напоминание через несколько дней уже некстати. */
export const UNPAID_MAX_AGE_MS = 24 * HOUR;

/** Письмо по брошенному заказу. */
export const UNPAID_KIND = "unpaid";

export interface UnpaidCandidate {
  id: string;
  userId: string;
  workshopSlug: string;
  status: "pending" | "paid" | "canceled" | "refunded";
  createdAt: Date;
  /** contactEmail заказа или email аккаунта, в нижнем регистре. */
  email: string;
}

export interface UnpaidContext {
  /** Курс уже у человека: оплачен любым заказом или выдан доступ. */
  owns: (candidate: UnpaidCandidate) => boolean;
  /** Письмо «оплата не завершилась» уже уходило по этому заказу. */
  reminded: (orderId: string) => boolean;
  now: Date;
}

const personKey = (c: UnpaidCandidate) => `${c.email}\n${c.workshopSlug}`;

/**
 * Заказы, по которым пора написать. На человека и курс — не больше одного
 * письма: несколько брошенных попыток подряд дают одно письмо, по последней,
 * и только когда с неё прошёл час — вдруг он прямо сейчас платит заново.
 */
export function dueUnpaidReminders(
  candidates: UnpaidCandidate[],
  { owns, reminded, now }: UnpaidContext,
): UnpaidCandidate[] {
  const latest = new Map<string, UnpaidCandidate>();
  const alreadyReminded = new Set<string>();
  for (const candidate of candidates) {
    const key = personKey(candidate);
    if (reminded(candidate.id)) alreadyReminded.add(key);
    const current = latest.get(key);
    if (!current || candidate.createdAt > current.createdAt) {
      latest.set(key, candidate);
    }
  }

  const due: UnpaidCandidate[] = [];
  for (const [key, order] of latest) {
    const age = now.getTime() - order.createdAt.getTime();
    if (order.status !== "pending" && order.status !== "canceled") continue;
    if (age < UNPAID_DELAY_MS || age > UNPAID_MAX_AGE_MS) continue;
    if (alreadyReminded.has(key) || owns(order)) continue;
    due.push(order);
  }
  return due;
}
