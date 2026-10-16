import { render } from "@react-email/components";
import nodemailer from "nodemailer";
import type { ReactNode } from "react";
import { Resend } from "resend";

import { env } from "./env";

export type EmailProviderName = "resend" | "postbox";

/**
 * Файл во вложении письма (например, PDF-бриф мастер-класса): либо содержимое,
 * либо ссылка, по которой провайдер скачает файл сам. Ссылка — для крупных
 * файлов: тело запроса от 30 КБ с нашего хоста до Resend не доходит.
 */
export type EmailAttachment =
  | { filename: string; content: Buffer }
  | { filename: string; path: string };

/** Письмо, которое умеет отправить любой провайдер: React-шаблон или готовый HTML. */
export type OutgoingEmail = {
  attachments?: EmailAttachment[];
  from: string;
  idempotencyKey?: string;
  subject: string;
  to: string[];
} & ({ react: ReactNode } | { html: string });

export interface EmailProvider {
  name: EmailProviderName;
  label: string;
  isConfigured: () => boolean;
  send: (email: OutgoingEmail) => Promise<void>;
}

export const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

const withAttachments = (email: OutgoingEmail) =>
  email.attachments?.length ? { attachments: email.attachments } : {};

const resendProvider: EmailProvider = {
  name: "resend",
  label: "Resend",
  isConfigured: () => resend !== null,
  async send(email) {
    if (!resend) throw new Error("Resend is not configured");
    const body = "html" in email ? { html: email.html } : { react: email.react };
    const { error } = await resend.emails.send(
      {
        to: email.to,
        from: email.from,
        subject: email.subject,
        ...body,
        ...withAttachments(email),
      },
      email.idempotencyKey
        ? { idempotencyKey: email.idempotencyKey }
        : undefined,
    );
    if (error) throw new Error(`Resend error: ${error.message}`);
  },
};

let postboxTransport: ReturnType<typeof nodemailer.createTransport> | null =
  null;

/**
 * Yandex Cloud Postbox по SMTP. Логин — идентификатор API-ключа сервисного
 * аккаунта (с областью yc.postbox.send), пароль — секретная часть ключа.
 * Адрес отправителя должен быть подтверждён в Postbox.
 */
const postboxProvider: EmailProvider = {
  name: "postbox",
  label: "Yandex Postbox",
  isConfigured: () =>
    Boolean(env.POSTBOX_SMTP_USER && env.POSTBOX_SMTP_PASSWORD),
  async send(email) {
    postboxTransport ??= nodemailer.createTransport({
      host: env.POSTBOX_SMTP_HOST,
      port: env.POSTBOX_SMTP_PORT,
      // 465 — SMTPS; на 587 соединение поднимается через STARTTLS.
      secure: env.POSTBOX_SMTP_PORT === 465,
      requireTLS: env.POSTBOX_SMTP_PORT !== 465,
      auth: {
        user: env.POSTBOX_SMTP_USER,
        pass: env.POSTBOX_SMTP_PASSWORD,
      },
      connectionTimeout: 10_000,
      socketTimeout: 30_000,
    });
    // Postbox не знает ключа идемпотентности: повторную отправку он не отсечёт.
    await postboxTransport.sendMail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: "html" in email ? email.html : await render(email.react),
      ...withAttachments(email),
    });
  },
};

const providers: Record<EmailProviderName, EmailProvider> = {
  resend: resendProvider,
  postbox: postboxProvider,
};

/** Провайдеры по порядку попыток: основной (EMAIL_PROVIDER), затем запасной. */
export function requestedEmailProviders(): EmailProvider[] {
  const names = [env.EMAIL_PROVIDER ?? "resend", env.EMAIL_FALLBACK_PROVIDER];
  return [...new Set(names)]
    .filter((name): name is EmailProviderName => Boolean(name))
    .map((name) => providers[name]);
}
