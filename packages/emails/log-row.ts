import type { EmailAttempt } from "@stariva/db";

const MAX_ERROR_LENGTH = 500;

/**
 * Заказ мастер-класса и вид письма из ключа идемпотентности сайта
 * (workshop:<заказ>:<вид>:email). У писем без такого ключа — пустой объект.
 */
export function emailContext(idempotencyKey?: string) {
  const match = /^workshop:([^:]+):([^:]+):email$/.exec(idempotencyKey ?? "");
  return match ? { workshopOrderId: match[1], kind: match[2] } : {};
}

/** Текст ошибки провайдера для журнала: без стека и не длиннее разумного. */
export function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
}

export interface EmailLogEntry {
  to: string[];
  subject: string;
  attempts: EmailAttempt[];
  attachments: number;
  idempotencyKey?: string;
  /** HTML письма; пусто, если тело в журнал не кладём. */
  html?: string | null;
  durationMs: number;
}

/**
 * Строка email_log по итогам отправки: доставил первый успешный провайдер, а
 * если не доставил никто — «failed» с ответом последнего.
 */
export function emailLogRow(entry: EmailLogEntry) {
  const delivered = entry.attempts.find((attempt) => attempt.ok);
  const last = entry.attempts.at(-1);
  return {
    recipient: entry.to.join(", "),
    subject: entry.subject,
    status: delivered ? ("sent" as const) : ("failed" as const),
    provider: (delivered ?? last)?.provider ?? null,
    attempts: entry.attempts,
    error: delivered ? null : (last?.error ?? null),
    attachments: entry.attachments,
    idempotencyKey: entry.idempotencyKey ?? null,
    html: entry.html ?? null,
    durationMs: entry.durationMs,
    ...emailContext(entry.idempotencyKey),
  };
}
