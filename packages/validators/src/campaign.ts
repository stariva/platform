import { z } from "zod";

/**
 * Адрес, добавленный в рассылку вручную. Одна проверка для формы админки и
 * API: что форма пропустила, сервер не отклонит.
 */
export const campaignEmailSchema = z.email().max(254);

/**
 * Адреса из поля «вручную»: через запятую, точку с запятой, пробел или с
 * новой строки. Подходящие — в нижнем регистре и без повторов, остальные —
 * как ввели, чтобы показать их рядом с полем.
 */
export function parseCampaignEmails(text: string) {
  const words = text.split(/[\s,;]+/).filter(Boolean);
  const isValid = (word: string) => campaignEmailSchema.safeParse(word).success;
  return {
    emails: [
      ...new Set(words.filter(isValid).map((email) => email.toLowerCase())),
    ],
    invalid: words.filter((word) => !isValid(word)),
  };
}
