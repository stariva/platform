import { logger } from "@stariva/config";
import { db, emailLog } from "@stariva/db";

import { type EmailLogEntry, emailLogRow } from "./log-row";

/** Дольше в базе не ждём: журнал не должен задерживать само письмо. */
const WRITE_TIMEOUT_MS = 3000;

/**
 * Записывает итог отправки в email_log. Сбой записи только логируем: письмо
 * уже ушло (или не ушло), и журнал не должен его ломать.
 */
export async function recordEmail(entry: EmailLogEntry): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.insert(emailLog).values(emailLogRow(entry)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("email_log write timed out")),
          WRITE_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    logger.error("email_log.write_failed", error, { subject: entry.subject });
  } finally {
    clearTimeout(timer);
  }
}
