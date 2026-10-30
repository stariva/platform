import { render } from "@react-email/components";
import type { ReactNode } from "react";
import { Resend } from "resend";

import { env } from "./env";
import { signRequest } from "./sigv4";

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

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const resendProvider: EmailProvider = {
  name: "resend",
  label: "Resend",
  isConfigured: () => resend !== null,
  async send(email) {
    if (!resend) throw new Error("Resend is not configured");
    const body =
      "html" in email ? { html: email.html } : { react: email.react };
    const { error } = await resend.emails.send(
      {
        to: email.to,
        from: email.from,
        subject: email.subject,
        ...body,
        ...(email.attachments?.length
          ? { attachments: email.attachments }
          : {}),
      },
      email.idempotencyKey
        ? { idempotencyKey: email.idempotencyKey }
        : undefined,
    );
    if (error) throw new Error(`Resend error: ${error.message}`);
  },
};

const POSTBOX_REGION = "ru-central1";
// В подписи запросов Postbox сервис называется ses, а не postbox.
const POSTBOX_SERVICE = "ses";
const POSTBOX_TIMEOUT_MS = 30_000;
// Postbox limits the entire email, including attachments, to 10 MB.
const POSTBOX_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Ключ доступа сервисного аккаунта Postbox или null, если он не задан. */
const postboxCredentials = () =>
  env.POSTBOX_ACCESS_KEY_ID && env.POSTBOX_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.POSTBOX_ACCESS_KEY_ID,
        secretAccessKey: env.POSTBOX_SECRET_ACCESS_KEY,
      }
    : null;

/** Postbox принимает вложения только содержимым (base64): ссылки качаем сами. */
async function postboxAttachment(attachment: EmailAttachment) {
  const sizeError = () =>
    new Error(
      `Attachment ${attachment.filename} exceeds Postbox's 10 MB size limit`,
    );
  let content: Buffer;
  if ("content" in attachment) {
    content = attachment.content;
  } else {
    const res = await fetch(attachment.path, {
      signal: AbortSignal.timeout(POSTBOX_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(
        `Attachment ${attachment.filename} download failed: HTTP ${res.status}`,
      );
    }
    if (
      Number(res.headers.get("content-length")) > POSTBOX_MAX_ATTACHMENT_BYTES
    ) {
      await res.body?.cancel().catch(() => {});
      throw sizeError();
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > POSTBOX_MAX_ATTACHMENT_BYTES) {
            await reader.cancel().catch(() => {});
            throw sizeError();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    content = Buffer.concat(chunks, size);
  }
  if (content.byteLength > POSTBOX_MAX_ATTACHMENT_BYTES) throw sizeError();
  return {
    FileName: attachment.filename,
    RawContent: content.toString("base64"),
  };
}

/**
 * Yandex Cloud Postbox через AWS-совместимый REST API (SendEmail, SESv2).
 * Запрос подписывается статическим ключом сервисного аккаунта с ролью
 * postbox.sender; адрес отправителя должен быть подтверждён в Postbox.
 */
const postboxProvider: EmailProvider = {
  name: "postbox",
  label: "Yandex Postbox",
  isConfigured: () => postboxCredentials() !== null,
  async send(email) {
    const credentials = postboxCredentials();
    if (!credentials) throw new Error("Postbox is not configured");
    const html = "html" in email ? email.html : await render(email.react);
    const attachments = email.attachments?.length
      ? await Promise.all(email.attachments.map(postboxAttachment))
      : undefined;
    const body = JSON.stringify({
      FromEmailAddress: email.from,
      Destination: { ToAddresses: email.to },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
          ...(attachments ? { Attachments: attachments } : {}),
        },
      },
    });
    const url = new URL("/v2/email/outbound-emails", env.POSTBOX_ENDPOINT);
    // Host подставит сам fetch; в подписи он учитывается внутри signRequest.
    const { host: _host, ...headers } = signRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body,
      ...credentials,
      region: POSTBOX_REGION,
      service: POSTBOX_SERVICE,
    });
    // Postbox не знает ключа идемпотентности: повторную отправку он не отсечёт.
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(POSTBOX_TIMEOUT_MS),
    });
    if (!res.ok) {
      const details = (await res.text().catch(() => "")).slice(0, 500);
      throw new Error(`Postbox error: HTTP ${res.status} ${details}`.trim());
    }
  },
};

const providers: Record<EmailProviderName, EmailProvider> = {
  resend: resendProvider,
  postbox: postboxProvider,
};

/** Провайдеры по порядку попыток: основной (EMAIL_PROVIDER), затем запасной. */
export function selectedEmailProviders(): EmailProvider[] {
  const names = [env.EMAIL_PROVIDER, env.EMAIL_FALLBACK_PROVIDER];
  return [...new Set(names)]
    .filter((name): name is EmailProviderName => Boolean(name))
    .map((name) => providers[name]);
}
