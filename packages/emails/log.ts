import { logger } from "@stariva/config";
import { and, db, emailLog, eq, gt } from "@stariva/db";

import { type EmailLogEntry, emailLogRow } from "./log-row";

/** Дольше в базе не ждём: журнал не должен задерживать само письмо. */
const WRITE_TIMEOUT_MS = 3000;

/** Как Resend: повтор с тем же ключом в течение суток письмо не дублирует. */
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Уже отправлено ли письмо с этим ключом идемпотентности. Postbox ключа не
 * знает, поэтому повторы (Telegram отказал, webhook пришёл снова) отсекаем
 * по журналу. Журнал недоступен — считаем, что не отправлено: лучше дубль,
 * чем потерянное письмо.
 */
export async function wasEmailSent(idempotencyKey: string): Promise<boolean> {
  try {
    const rows = await withTimeout(
      db
        .select({ id: emailLog.id })
        .from(emailLog)
        .where(
          and(
            eq(emailLog.idempotencyKey, idempotencyKey),
            eq(emailLog.status, "sent"),
            gt(
              emailLog.createdAt,
              new Date(Date.now() - IDEMPOTENCY_WINDOW_MS),
            ),
          ),
        )
        .limit(1),
      "email_log read timed out",
    );
    return rows.length > 0;
  } catch (error) {
    logger.error("email_log.read_failed", error, { idempotencyKey });
    return false;
  }
}

async function withTimeout<T>(promise: PromiseLike<T>, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Записывает итог отправки в email_log. Сбой записи только логируем: письмо
 * уже ушло (или не ушло), и журнал не должен его ломать.
 */
export async function recordEmail(entry: EmailLogEntry): Promise<void> {
  try {
    await withTimeout(
      db.insert(emailLog).values(emailLogRow(entry)),
      "email_log write timed out",
    );
  } catch (error) {
    logger.error("email_log.write_failed", error, { subject: entry.subject });
  }
}
