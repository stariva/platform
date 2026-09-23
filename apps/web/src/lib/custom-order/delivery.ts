/** Testable without environment, database or real recipients. */
export interface Notification {
  id: string;
  message: string;
  photoBase64: string | null;
  photoType: string | null;
}
export interface DeliveryConfig {
  telegramToken?: string;
  telegramChatId?: string;
  emailKey?: string;
  emailFrom?: string;
  emailTo?: string;
}
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function deliverNotification(
  notification: Notification,
  config: DeliveryConfig,
  request: typeof fetch = fetch,
): Promise<boolean> {
  const channels: Promise<void>[] = [];
  const message = `Заявка ${notification.id}\n${notification.message}`;
  if (config.telegramToken && config.telegramChatId) {
    channels.push(
      (async () => {
        // Plain text chunks never break HTML entities or caption tags.
        for (let offset = 0; offset < message.length; offset += 3500) {
          const res = await request(
            `https://api.telegram.org/bot${config.telegramToken}/sendMessage`,
            {
              method: "POST",
              signal: AbortSignal.timeout(10_000),
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: config.telegramChatId,
                text: message.slice(offset, offset + 3500),
                disable_web_page_preview: true,
              }),
            },
          );
          if (!res.ok || !(await res.json()).ok)
            throw new Error("telegram_message_failed");
        }
        if (notification.photoBase64) {
          const form = new FormData();
          form.append("chat_id", config.telegramChatId ?? "");
          form.append("caption", `Фото к заявке ${notification.id}`);
          form.append(
            "document",
            new Blob([Buffer.from(notification.photoBase64, "base64")], {
              type: notification.photoType ?? "image/jpeg",
            }),
            "inspiration",
          );
          const res = await request(
            `https://api.telegram.org/bot${config.telegramToken}/sendDocument`,
            { method: "POST", body: form, signal: AbortSignal.timeout(15_000) },
          );
          if (!res.ok || !(await res.json()).ok)
            throw new Error("telegram_photo_failed");
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
            "Idempotency-Key": `custom-order/${notification.id}`,
          },
          body: JSON.stringify({
            from: config.emailFrom,
            to: config.emailTo,
            subject: `Индивидуальный заказ Stariva · ${notification.id}`,
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
  return (await Promise.allSettled(channels)).some(
    (result) => result.status === "fulfilled",
  );
}
