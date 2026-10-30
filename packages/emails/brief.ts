import StarivaWorkshopBriefEmail, {
  workshopBriefEmailSubject,
} from "./emails/stariva-workshop-brief";
import { sendEmail } from "./send";

/** PDF-материал курса в закрытом бакете и временная ссылка на него. */
export interface WorkshopBriefFile {
  /** Подпись из админки: «Бриф «Ёлка макраме»». */
  label: string;
  filename: string;
  url: string;
}

/**
 * Отправляет покупателю PDF-бриф мастер-класса во вложении. Ошибку отправки
 * пробрасывает: вызывающий решает, повторять ли.
 */
export async function sendWorkshopBriefEmail({
  to,
  idempotencyKey,
  workshopTitle,
  accessUrl,
  files,
}: {
  to: string;
  idempotencyKey?: string;
  workshopTitle: string;
  accessUrl: string;
  files: WorkshopBriefFile[];
}): Promise<void> {
  await sendEmail({
    idempotencyKey,
    // В письме личная ссылка доступа к заказу: в журнал её не кладём
    sensitive: true,
    to: [to],
    subject: workshopBriefEmailSubject({ workshopTitle }),
    react: StarivaWorkshopBriefEmail({
      workshopTitle,
      accessUrl,
      files: files.map((file) => file.label),
    }),
    attachments: files.map(({ filename, url }) => ({ filename, path: url })),
  });
}
