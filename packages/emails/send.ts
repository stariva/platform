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
  newOpenToken,
  openPixelUrl,
  withOpenPixel,
  withoutOpenPixel,
} from "./open-pixel";
import {
  type EmailAttachment,
  type OutgoingEmail,
  selectedEmailProviders,
} from "./providers";

export type { EmailAttachment } from "./providers";

export interface Emails {
  idempotencyKey?: string;
  /**
   * Пиксель открытия в письме уже есть, с этим токеном (рассылки ставят свой).
   * Без него пиксель добавит сама отправка.
   */
  openToken?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
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
      ...(email.headers ? { headers: email.headers } : {}),
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
    headers: email.headers,
    idempotencyKey: email.idempotencyKey,
    openToken: email.openToken,
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

/**
 * Письмо готовым HTML с пикселем открытия. Отрисовываем один раз: этот HTML
 * уходит любому провайдеру, а в журнал ложится он же, но с выключенным
 * пикселем. Не отрисовалось — письмо уходит как есть (провайдер скажет, что
 * с ним не так), без тела в журнале и без учёта открытий.
 */
async function prepare(email: OutgoingEmail & { openToken?: string }): Promise<{
  email: OutgoingEmail;
  html: string | null;
  openToken: string | null;
}> {
  const { openToken: given, ...outgoing } = email;
  let html: string;
  try {
    html = "html" in outgoing ? outgoing.html : await render(outgoing.react);
  } catch (error) {
    logger.error("email_log.render_failed", error, { subject: email.subject });
    return { email: outgoing, html: null, openToken: given ?? null };
  }
  const { react: _react, ...rest } = outgoing as OutgoingEmail & {
    react?: unknown;
  };
  // Пиксель рассылки уже в письме; остальным письмам ставим свой
  const openToken = given ?? newOpenToken(email.idempotencyKey);
  const tracked = given
    ? html
    : withOpenPixel(html, openPixelUrl(openToken, env.STOREFRONT_URL));
  return {
    email: { ...rest, html: tracked },
    html: withoutOpenPixel(tracked, openToken),
    openToken,
  };
}

/**
 * Отправляет письмо основным провайдером (EMAIL_PROVIDER); если он не
 * настроен или отказал — запасным (EMAIL_FALLBACK_PROVIDER). Ошибка уходит
 * наружу, только когда не отправил ни один.
 */
async function deliver(original: OutgoingEmail & { openToken?: string }) {
  const startedAt = Date.now();
  const attempts: EmailAttempt[] = [];
  const { email, html, openToken } = await prepare(original);
  /** Итог отправки в журнал email_log: письма видно в админке. */
  const record = async () =>
    recordEmail({
      to: email.to,
      subject: email.subject,
      attempts,
      attachments: email.attachments?.length ?? 0,
      idempotencyKey: email.idempotencyKey,
      html,
      openToken,
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
      const messageId = await provider.send(email);
      attempts.push({
        provider: provider.name,
        ok: true,
        ...(messageId ? { messageId } : {}),
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
