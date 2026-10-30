/** Почтовые провайдеры, которыми отправляет сайт (поле provider в email_log). */
export const PROVIDER_LABELS: Record<string, string> = {
  resend: "Resend",
  postbox: "Yandex Postbox",
};

export const providerLabel = (provider: string | null) =>
  provider ? (PROVIDER_LABELS[provider] ?? provider) : "—";

/** Вид письма сайта — из ключа идемпотентности (workshop:<заказ>:<вид>:email). */
const KIND_LABELS: Record<string, string> = {
  booked: "О покупке",
  brief: "PDF-бриф",
  week: "Напоминание: неделя",
  day: "Напоминание: завтра",
  release: "Уроки открыты",
  unpaid: "Оплата не завершена",
};

export const kindLabel = (kind: string | null) =>
  kind ? (KIND_LABELS[kind] ?? null) : null;

/** Длительность попытки: «0,4 с», «15 с». */
export function duration(ms: number) {
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1).replace(".", ",") : Math.round(seconds)} с`;
}
