import StarivaWorkshopBriefEmail, {
  workshopBriefEmailSubject,
} from "./emails/stariva-workshop-brief";
import { sendEmail } from "./send";

/** PDF-материал курса, уже скачанный из закрытого бакета. */
export interface WorkshopBriefFile {
  /** Подпись из админки: «Бриф «Ёлка макраме»». */
  label: string;
  filename: string;
  content: Buffer;
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
    to: [to],
    subject: workshopBriefEmailSubject({ workshopTitle }),
    react: StarivaWorkshopBriefEmail({
      workshopTitle,
      accessUrl,
      files: files.map((file) => file.label),
    }),
    attachments: files.map(({ filename, content }) => ({ filename, content })),
  });
}
