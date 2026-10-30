import { telegramApiUrl } from "@/lib/telegram/api-url";

/** Testable without environment, database or real recipients. */
export interface Notification {
  id: string;
  message: string;
  photoBase64: string | null;
  photoType: string | null;
  /** Заголовок сообщения; по умолчанию «Заявка <id>». */
  title?: string;
  /** Тема письма; по умолчанию «Индивидуальный заказ Stariva · <id>». */
  emailSubject?: string;
  /** Префикс ключа идемпотентности письма; по умолчанию «custom-order». */
  idempotencyScope?: string;
}
export interface DeliveryConfig {
  telegramToken?: string;
  telegramChatId?: string;
  /** fetch для запросов к Telegram (например, через HTTP-прокси 3proxy). */
  telegramFetch?: typeof fetch;
  /** Таймаут одного запроса к Telegram; по умолчанию 10 с. */
  telegramTimeoutMs?: number;
  emailKey?: string;
  emailFrom?: string;
  emailTo?: string;
}
export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function deliverNotification(
  notification: Notification,
  config: DeliveryConfig,
  request: typeof fetch = fetch,
): Promise<boolean> {
  const channels: Promise<void>[] = [];
  const title = notification.title ?? `Заявка ${notification.id}`;
  const message = `${title}\n${notification.message}`;
  const missingEmail = missingEmailSettings(config);
  if (missingEmail.length > 0) {
    console.warn(
      `[notifications] ${title}: на почту не отправлено — не заданы ${missingEmail.join(", ")}`,
    );
  }
  const telegramRequest = config.telegramFetch ?? request;
  const telegramConfigured = Boolean(
    config.telegramToken && config.telegramChatId,
  );
  if (telegramConfigured) {
    channels.push(
      (async () => {
        // Plain text chunks never break HTML entities or caption tags.
        for (let offset = 0; offset < message.length; offset += 3500) {
          const res = await telegramRequest(
            telegramApiUrl(config.telegramToken ?? "", "sendMessage"),
            {
              method: "POST",
              signal: AbortSignal.timeout(config.telegramTimeoutMs ?? 10_000),
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: config.telegramChatId,
                text: message.slice(offset, offset + 3500),
                disable_web_page_preview: true,
              }),
            },
          );
          await assertTelegramOk(res, "telegram_message_failed");
        }
        if (notification.photoBase64) {
          const form = new FormData();
          form.append("chat_id", config.telegramChatId ?? "");
          form.append("caption", `Фото · ${title}`);
          form.append(
            "document",
            new Blob([Buffer.from(notification.photoBase64, "base64")], {
              type: notification.photoType ?? "image/jpeg",
            }),
            "inspiration",
          );
          const res = await telegramRequest(
            telegramApiUrl(config.telegramToken ?? "", "sendDocument"),
            {
              method: "POST",
              body: form,
              signal: AbortSignal.timeout(
                (config.telegramTimeoutMs ?? 10_000) + 5_000,
              ),
            },
          );
          await assertTelegramOk(res, "telegram_photo_failed");
        }
      })(),
    );
  }
  if (config.emailKey && config.emailFrom && config.emailTo) {
    channels.push(
      (async () => {
        const res = await request("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${config.emailKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `${notification.idempotencyScope ?? "custom-order"}/${notification.id}`,
          },
          body: JSON.stringify({
            from: config.emailFrom,
            to: config.emailTo,
            subject:
              notification.emailSubject ??
              `Индивидуальный заказ Stariva · ${notification.id}`,
            html: `<pre>${escapeHtml(message)}</pre>`,
            attachments: notification.photoBase64
              ? [
                  {
                    filename: `inspiration.${notification.photoType === "image/png" ? "png" : notification.photoType === "image/webp" ? "webp" : "jpg"}`,
                    content: notification.photoBase64,
                  },
                ]
              : undefined,
          }),
        });
        if (!res.ok || !(await res.json()).id) throw new Error("email_failed");
      })(),
    );
  }
  const results = await Promise.allSettled(channels);
  // Один канал может упасть, пока другой доставил: сообщение не потеряно,
  // но канал сломан — без лога этого не заметить.
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        `[notifications] ${title}: канал не доставил —`,
        result.reason,
      );
    }
  }
  // Telegram — основной канал мастера: если он настроен, без него доставка
  // не засчитывается и уведомление повторится. Почта — дубль.
  if (telegramConfigured) return results[0]?.status === "fulfilled";
  return results.some((result) => result.status === "fulfilled");
}

/** Переменные, без которых уведомления не уходят на почту. */
export function missingEmailSettings(config: DeliveryConfig): string[] {
  return [
    !config.emailKey && "RESEND_API_KEY",
    !config.emailFrom && "ORDER_EMAIL_FROM",
    !config.emailTo && "ORDER_EMAIL_TO",
  ].filter((name): name is string => Boolean(name));
}

/** Ошибка с кодом ответа и описанием от Telegram (или прокси) для лога. */
async function assertTelegramOk(res: Response, code: string) {
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (res.ok && body?.ok) return;
  throw new Error(
    `${code}: HTTP ${res.status}${body?.description ? ` ${body.description}` : ""}`,
  );
}
