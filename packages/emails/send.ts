import { render } from "@react-email/components";
import { logger } from "@stariva/config";
import type { EmailAttempt } from "@stariva/db";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { ReactNode } from "react";

import { env } from "./env";
import { recordEmail } from "./log";
import { errorText } from "./log-row";
import {
  type EmailAttachment,
  type OutgoingEmail,
  selectedEmailProviders,
} from "./providers";

export type { EmailAttachment } from "./providers";

export interface Emails {
  idempotencyKey?: string;
  /**
   * В письме код входа или личная ссылка (вход, сброс пароля, подтверждение
   * почты, доступ к заказу мастер-класса): тело в журнал email_log не кладём.
   */
  sensitive?: boolean;
  attachments?: EmailAttachment[];
  react: ReactNode;
  subject: string;
  to: string[];
  from?: string;
}

export type EmailHtml = {
  html: string;
  subject: string;
  to: string[];
  from?: string;
  idempotencyKey?: string;
};
export const sendEmail = async (email: Emails) => {
  if (env.EMAIL_SANDBOX_ENABLED) {
    const mailOptions: Mail.Options = {
      from: email.from ?? env.EMAIL_FROM,
      to: email.to,
      html: await render(email.react),
      subject: email.subject,
      ...(email.attachments?.length ? { attachments: email.attachments } : {}),
    };
    const transporter = nodemailer.createTransport({
      host: env.EMAIL_SANDBOX_HOST,
      secure: false,
      port: 2500,
    });
    return transporter.sendMail(mailOptions);
  }
  return deliver({
    to: email.to,
    from: email.from ?? env.EMAIL_FROM,
    subject: email.subject,
    react: email.react,
    attachments: email.attachments,
    idempotencyKey: email.idempotencyKey,
    sensitive: email.sensitive,
  });
};

export const sendEmailHtml = async (email: EmailHtml) =>
  deliver({
    to: email.to,
    from: email.from ?? env.EMAIL_FROM,
    subject: email.subject,
    html: email.html,
    idempotencyKey: email.idempotencyKey,
  });

/** HTML письма для журнала; не отрисовался — пишем письмо без тела, а не роняем отправку. */
async function htmlForLog(email: OutgoingEmail): Promise<string | null> {
  try {
    return "html" in email ? email.html : await render(email.react);
  } catch (error) {
    logger.error("email_log.render_failed", error, { subject: email.subject });
    return null;
  }
}

/**
 * Отправляет письмо основным провайдером (EMAIL_PROVIDER); если он не
 * настроен или отказал — запасным (EMAIL_FALLBACK_PROVIDER). Ошибка уходит
 * наружу, только когда не отправил ни один.
 */
async function deliver(email: OutgoingEmail & { sensitive?: boolean }) {
  const startedAt = Date.now();
  const attempts: EmailAttempt[] = [];
  /** Итог отправки в журнал email_log: письма видно в админке. */
  const record = async () =>
    recordEmail({
      to: email.to,
      subject: email.subject,
      attempts,
      attachments: email.attachments?.length ?? 0,
      idempotencyKey: email.idempotencyKey,
      html: email.sensitive ? null : await htmlForLog(email),
      durationMs: Date.now() - startedAt,
    });

  const chain = selectedEmailProviders().filter((provider) => {
    const configured = provider.isConfigured();
    if (!configured) {
      logger.warn(
        `${provider.label} is selected in EMAIL_PROVIDER / EMAIL_FALLBACK_PROVIDER but its credentials are missing.`,
      );
    }
    return configured;
  });
  if (chain.length === 0) {
    logger.warn(
      "No email provider is configured. Set RESEND_API_KEY or POSTBOX_ACCESS_KEY_ID and POSTBOX_SECRET_ACCESS_KEY in your .env file for emails to work.",
    );
    return;
  }
  let lastError: unknown;
  for (const [index, provider] of chain.entries()) {
    const attemptStartedAt = Date.now();
    try {
      await provider.send(email);
      attempts.push({
        provider: provider.name,
        ok: true,
        ms: Date.now() - attemptStartedAt,
      });
      await record();
      return;
    } catch (error) {
      logger.error(`${provider.label} failed to send email`, error, {
        recipientCount: email.to.length,
        idempotencyKey: email.idempotencyKey,
        willRetryWith: chain[index + 1]?.label,
      });
      attempts.push({
        provider: provider.name,
        ok: false,
        error: errorText(error),
        ms: Date.now() - attemptStartedAt,
      });
      lastError = error;
    }
  }
  await record();
  throw lastError;
}
