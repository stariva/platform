/** Мерка изделия под заказ: подпись как в форме, значение в сантиметрах. */
export interface DraftMeasurement {
  label: string;
  value: string;
}

/**
 * Заказ под заказ, каким его предлагает заявка: контакты, изделие из
 * каталога и параметры. Мастер правит его в диалоге «Выставить счёт».
 */
export interface OrderDraft {
  contactName: string;
  // Пустая строка — в заявке не телефон (Telegram, почта), мастер впишет сам
  contactPhone: string;
  contactEmail: string;
  // Пустая строка — заявка не с карточки товара
  productSlug: string;
  name: string;
  size: string;
  color: string;
  measurements: DraftMeasurement[];
  comment: string;
}

/** Поля формы заявки из jsonb data, которые нужны для заказа. */
export interface RequestFormData {
  name?: unknown;
  contact?: unknown;
  description?: unknown;
  productType?: unknown;
  size?: unknown;
  measurements?: unknown;
  color?: unknown;
}

/** Так параметры называют, пока мастер их не согласовал. */
export const TO_AGREE = "По согласованию";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/**
 * Российский мобильный в виде «+7 999 431-83-92»: по нему покупатель
 * открывает страницу заказа и платит. Не телефон — пустая строка.
 */
export function formatPhone(raw: string): string {
  if (/[a-zа-я@]/i.test(raw)) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9")) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8"))
    digits = `7${digits.slice(1)}`;
  if (digits.length !== 11 || !digits.startsWith("7")) return "";
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

/** Slug товара из ссылки на карточку: …/catalog/clothes/<slug>. */
export function slugFromUrl(url: string): string {
  const match = url.match(
    /\/catalog\/(?:[^/?#\s]+\/)?([^/?#\s]+)\/?(?:[?#]|$)/,
  );
  return match?.[1] ?? "";
}

/**
 * Разбирает заявку в черновик заказа. Заявка с карточки товара пишет в
 * описание строки «Изделие: …», «Ссылка: …», «Размер: …», «Мерки:» с
 * мерками по строке, «Цвет: …» и «Комментарий: …» (он последний и может
 * быть многострочным). Заявка с главной — свободный текст: он уходит в
 * комментарий целиком.
 */
export function draftFromRequest(data: RequestFormData): OrderDraft {
  const contact = text(data.contact);
  const description = text(data.description);
  const draft: OrderDraft = {
    contactName: text(data.name),
    contactPhone: formatPhone(contact),
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : "",
    productSlug: "",
    name: "",
    size: text(data.size),
    color: text(data.color),
    measurements: [],
    comment: "",
  };

  const lines = description.split("\n");
  if (lines[0]?.startsWith("Изделие: ")) {
    let inMeasurements = false;
    for (const [index, line] of lines.entries()) {
      const [, key, value = ""] = line.match(/^([^:]+):\s*(.*)$/) ?? [];
      if (key === "Комментарий") {
        draft.comment = [value, ...lines.slice(index + 1)].join("\n").trim();
        break;
      }
      if (key === "Мерки") {
        inMeasurements = true;
        continue;
      }
      const measurement = value.match(/^(\d{1,4}(?:[.,]\d{1,2})?)\s*см$/);
      if (inMeasurements && key && measurement?.[1]) {
        draft.measurements.push({ label: key.trim(), value: measurement[1] });
        continue;
      }
      inMeasurements = false;
      if (key === "Изделие") draft.name = value.trim();
      else if (key === "Ссылка") draft.productSlug = slugFromUrl(value);
      else if (key === "Размер") draft.size = value.trim();
      else if (key === "Цвет") draft.color = value.trim();
    }
  } else {
    const measurements = text(data.measurements);
    draft.comment = [description, measurements && `Мерки: ${measurements}`]
      .filter(Boolean)
      .join("\n");
  }

  const productType = text(data.productType);
  draft.name ||= productType ? `${productType} на заказ` : "Изделие на заказ";
  draft.size ||= TO_AGREE;
  draft.color ||= TO_AGREE;
  draft.comment = draft.comment.slice(0, 1500);
  return draft;
}
