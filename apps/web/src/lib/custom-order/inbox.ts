import { createHash, randomUUID } from "node:crypto";
import { customOrderRequests, db } from "@stariva/db";
import type { VisitorInfo } from "@stariva/db/schema";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { baseEnv, env } from "@/env";
import { formatTouch } from "@/lib/campaign-attribution";
import { LEGAL_VERSION } from "@/lib/legal";
import { formatVisitor } from "@/lib/visitor";
import {
  deliverNotification,
  missingEmailSettings,
  type Notification,
} from "./delivery";
import type { OrderRequest } from "./schema";

export function notificationConfigured() {
  return Boolean(
    (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) ||
      (baseEnv.RESEND_API_KEY && env.ORDER_EMAIL_TO && env.ORDER_EMAIL_FROM),
  );
}
/** Номер заявки, как его видят покупатель и мастер. */
export const requestTitle = (number: number) => `Заявка №${number}`;
/**
 * Сохраняет заявку, фото и текст уведомления с источником и возвращает ID
 * и порядковый номер. Повтор с тем же ID допустим только при совпадении
 * данных и фото и возвращает тот же номер; иначе выбрасывает ошибку
 * request_conflict.
 */
export async function saveRequest(
  data: OrderRequest,
  photo: File | null,
  visitor?: VisitorInfo,
): Promise<{ id: string; number: number }> {
  const id = data.requestId ?? randomUUID();
  const photoBase64 = photo
    ? Buffer.from(await photo.arrayBuffer()).toString("base64")
    : null;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(data))
    .update(photoBase64 ?? "")
    .digest("hex");
  const message = [
    `Имя: ${data.name || "Не указано"}`,
    `Контакт: ${data.contact}`,
    `Описание: ${data.description}`,
    data.productType && `Изделие: ${data.productType}`,
    data.size && `Размер: ${data.size}`,
    data.measurements && `Мерки: ${data.measurements}`,
    data.measurementHelp === "true" && "Нужна помощь с замерами",
    data.color && `Цвет: ${data.color}`,
    data.complexity && `Плетение: ${data.complexity}`,
    data.budget && `Бюджет: ${data.budget}`,
    data.estimateMin !== undefined &&
      `Оценка калькулятора: ${data.estimateMin}–${data.estimateMax} ₽`,
    data.attribution && `Источник: ${formatTouch(data.attribution.last)}`,
    data.attribution &&
      data.attribution.first.at !== data.attribution.last.at &&
      `Первый заход: ${formatTouch(data.attribution.first)}`,
    ...(visitor ? formatVisitor(visitor) : []),
    `Согласие на обработку данных: ${LEGAL_VERSION}, ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
  const inserted = await db
    .insert(customOrderRequests)
    .values({
      id,
      fingerprint,
      data,
      message,
      visitor: visitor ?? null,
      photoBase64,
      photoType: photo?.type,
    })
    .onConflictDoNothing()
    .returning({ number: customOrderRequests.number });
  if (inserted[0]) return { id, number: inserted[0].number };
  const [existing] = await db
    .select({
      fingerprint: customOrderRequests.fingerprint,
      number: customOrderRequests.number,
    })
    .from(customOrderRequests)
    .where(eq(customOrderRequests.id, id))
    .limit(1);
  if (!existing || existing.fingerprint !== fingerprint)
    throw new Error("request_conflict");
  return { id, number: existing.number };
}
async function notify(item: Notification) {
  return deliverNotification(item, {
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    telegramChatId: env.TELEGRAM_CHAT_ID,
    emailKey: baseEnv.RESEND_API_KEY,
    emailFrom: env.ORDER_EMAIL_FROM,
    emailTo: env.ORDER_EMAIL_TO,
  });
}
export async function dispatchRequest(
  id: string,
  deliver: (item: Notification) => Promise<boolean> = notify,
) {
  const now = new Date();
  const [item] = await db
    .update(customOrderRequests)
    .set({
      lockedUntil: new Date(Date.now() + 120_000),
      attempts: sql`${customOrderRequests.attempts} + 1`,
    })
    .where(
      and(
        eq(customOrderRequests.id, id),
        isNull(customOrderRequests.deliveredAt),
        lt(customOrderRequests.nextAttemptAt, now),
        or(
          isNull(customOrderRequests.lockedUntil),
          lt(customOrderRequests.lockedUntil, now),
        ),
      ),
    )
    .returning();
  if (!item) return;
  let delivered = false;
  try {
    const title = requestTitle(item.number);
    delivered = await deliver({
      ...item,
      title,
      emailSubject: `Индивидуальный заказ Stariva · ${title}`,
    });
  } finally {
    await db
      .update(customOrderRequests)
      .set({
        deliveredAt: delivered ? new Date() : null,
        lockedUntil: null,
        nextAttemptAt: new Date(
          Date.now() +
            Math.min(60 * 60_000, 60_000 * 2 ** Math.min(item.attempts, 6)),
        ),
      })
      .where(eq(customOrderRequests.id, id));
    if (!delivered)
      console.error("[custom-order] notification_pending", {
        id,
        attempts: item.attempts,
      });
  }
}
export async function retryPendingRequests() {
  const rows = await db
    .select({ id: customOrderRequests.id })
    .from(customOrderRequests)
    .where(
      and(
        isNull(customOrderRequests.deliveredAt),
        lt(customOrderRequests.nextAttemptAt, new Date()),
        or(
          isNull(customOrderRequests.lockedUntil),
          lt(customOrderRequests.lockedUntil, new Date()),
        ),
      ),
    )
    .orderBy(customOrderRequests.nextAttemptAt)
    .limit(10);
  await Promise.allSettled(rows.map(({ id }) => dispatchRequest(id)));
}
/** При старте сервера: громко, если заявки и заказы не уходят на почту. */
export function warnIfOrderEmailMissing() {
  const missing = missingEmailSettings({
    emailKey: baseEnv.RESEND_API_KEY,
    emailFrom: env.ORDER_EMAIL_FROM,
    emailTo: env.ORDER_EMAIL_TO,
  });
  if (missing.length > 0) {
    console.warn(
      `[notifications] Уведомления о заказах не уходят на почту — не заданы ${missing.join(", ")}`,
    );
  }
}
let retryTimer: ReturnType<typeof setInterval> | undefined;
export function startOrderRetryWorker() {
  if (retryTimer) return;
  const tick = () =>
    retryPendingRequests().catch(() =>
      console.error("[custom-order] retry_worker_failed"),
    );
  retryTimer = setInterval(tick, 60_000);
  retryTimer.unref();
  void tick();
}
