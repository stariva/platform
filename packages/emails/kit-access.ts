import StarivaWorkshopEmail from "./emails/stariva-workshop";
import { sendEmail } from "./send";

/**
 * Письмо покупателю набора: доступ к урокам открыт, коробку привезёт Ozon.
 * Ту же версию письма сайт отправляет сразу после оплаты; эта функция нужна
 * кнопке в заказе, когда первое письмо не дошло. Ошибку отправки
 * пробрасывает: вызывающий решает, повторять ли.
 */
export async function sendKitAccessEmail({
  to,
  idempotencyKey,
  workshopTitle,
  accessUrl,
}: {
  to: string;
  idempotencyKey?: string;
  workshopTitle: string;
  accessUrl: string;
}): Promise<void> {
  await sendEmail({
    idempotencyKey,
    to: [to],
    subject: `Доступ к мастер-классу «${workshopTitle}» открыт — Stariva`,
    react: StarivaWorkshopEmail({
      kind: "booked",
      kit: true,
      workshopTitle,
      releaseLabel: null,
      accessUrl,
      materials: [],
    }),
  });
}
