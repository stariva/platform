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
  campaign: "Рассылка",
};

export const kindLabel = (kind: string | null) =>
  kind ? (KIND_LABELS[kind] ?? null) : null;

/** Что Postbox сообщил о письме (события из Data Streams). */
export interface DeliveryFacts {
  deliveredAt: Date | null;
  delayedAt: Date | null;
  bouncedAt: Date | null;
  bounceDetail: string | null;
  complainedAt: Date | null;
}

export interface DeliveryState {
  label: string;
  variant: "success-light" | "warning-light" | "destructive-light";
  at: Date;
  detail?: string;
}

/**
 * Итог доставки по самому важному событию: жалоба важнее отказа, отказ —
 * доставки, доставка — задержки. null — Postbox ещё ничего не сообщил (или
 * письмо ушло через Resend, о нём событий нет).
 */
export function deliveryState(row: DeliveryFacts): DeliveryState | null {
  if (row.complainedAt) {
    return {
      label: "Жалоба на спам",
      variant: "destructive-light",
      at: row.complainedAt,
    };
  }
  if (row.bouncedAt) {
    return {
      label: "Не доставлено",
      variant: "destructive-light",
      at: row.bouncedAt,
      detail: row.bounceDetail ?? undefined,
    };
  }
  if (row.deliveredAt) {
    return {
      label: "Доставлено",
      variant: "success-light",
      at: row.deliveredAt,
    };
  }
  if (row.delayedAt) {
    return {
      label: "Задерживается",
      variant: "warning-light",
      at: row.delayedAt,
    };
  }
  return null;
}

/** «2 раза», «5 раз», «22 раза». */
export function times(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
    ? "раза"
    : "раз";
}

/** Длительность попытки: «0,4 с», «15 с». */
export function duration(ms: number) {
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1).replace(".", ",") : Math.round(seconds)} с`;
}
