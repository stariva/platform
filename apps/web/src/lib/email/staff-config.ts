import { isEmailConfigured, sendEmailHtml } from "@stariva/emails";
import { env } from "@/env";
import type {
  DeliveryConfig,
  NotificationEmail,
} from "@/lib/custom-order/delivery";

/**
 * Параметры почты мастера для deliverNotification: письмо уходит через общий
 * конвейер @stariva/emails — Postbox основной, при сбое Resend, попытки
 * попадают в журнал email_log. Без настроенного провайдера emailSend не
 * задаётся: иначе «доставка» засчитывалась бы в пустую.
 */
export function staffEmailDelivery(): Pick<
  DeliveryConfig,
  "emailFrom" | "emailTo" | "emailSend"
> {
  return {
    emailFrom: env.ORDER_EMAIL_FROM,
    emailTo: env.ORDER_EMAIL_TO,
    emailSend: isEmailConfigured()
      ? (mail: NotificationEmail) =>
          sendEmailHtml({
            from: mail.from,
            to: [mail.to],
            subject: mail.subject,
            html: mail.html,
            attachments: mail.attachments,
            idempotencyKey: mail.idempotencyKey,
          })
      : undefined,
  };
}

/** Имена переменных, без которых staff-почта не настроена (для лога). */
export function missingStaffEmailSettings(): string[] {
  const missing = [
    !env.ORDER_EMAIL_FROM && "ORDER_EMAIL_FROM",
    !env.ORDER_EMAIL_TO && "ORDER_EMAIL_TO",
  ].filter((name): name is string => Boolean(name));
  if (!isEmailConfigured()) {
    missing.push(
      "POSTBOX_ACCESS_KEY_ID/POSTBOX_SECRET_ACCESS_KEY или RESEND_API_KEY",
    );
  }
  return missing;
}
