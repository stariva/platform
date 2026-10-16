import { render } from "@react-email/components";
import { logger } from "@stariva/config";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { ReactNode } from "react";

import { env } from "./env";
import {
  type EmailAttachment,
  type OutgoingEmail,
  requestedEmailProviders,
} from "./providers";

export { type EmailAttachment, resend } from "./providers";

export interface Emails {
  idempotencyKey?: string;
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
  });
};

export const sendEmailHtml = async (email: EmailHtml) =>
  deliver({
    to: email.to,
    from: email.from ?? env.EMAIL_FROM,
    subject: email.subject,
    html: email.html,
  });

/**
 * Отправляет письмо основным провайдером (EMAIL_PROVIDER); если он не
 * настроен или отказал — запасным (EMAIL_FALLBACK_PROVIDER). Ошибка уходит
 * наружу, только когда не отправил ни один.
 */
async function deliver(email: OutgoingEmail) {
  const requested = requestedEmailProviders();
  const chain = requested.filter((provider) => provider.isConfigured());
  for (const provider of requested) {
    if (!chain.includes(provider)) {
      logger.warn(
        `${provider.label} is selected in EMAIL_PROVIDER / EMAIL_FALLBACK_PROVIDER but its credentials are missing.`,
      );
    }
  }
  if (chain.length === 0) {
    logger.warn(
      "No email provider is configured. Set RESEND_API_KEY or POSTBOX_ACCESS_KEY_ID and POSTBOX_SECRET_ACCESS_KEY in your .env file for emails to work.",
    );
    return;
  }
  let lastError: unknown;
  for (const provider of chain) {
    try {
      await provider.send(email);
      return;
    } catch (error) {
      logger.error(`${provider.label} failed to send email`, error, {
        to: email.to,
        willRetryWith: chain[chain.indexOf(provider) + 1]?.label,
      });
      lastError = error;
    }
  }
  throw lastError;
}
