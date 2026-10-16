import { customOrderRequests, sql } from "@stariva/db";

/** Поле формы из jsonb data как текст; пустая строка — как отсутствующее. */
export const field = (name: string) =>
  sql<string | null>`nullif(${customOrderRequests.data} ->> ${name}, '')`;

/**
 * Поля заявки, общие для списка и карточки. Форма на главной и заказ
 * своего варианта из карточки товара пишут в одну таблицу; у второй
 * описание начинается со строки «Изделие: …».
 */
export const requestFields = {
  id: customOrderRequests.id,
  number: customOrderRequests.number,
  name: field("name"),
  contact: field("contact"),
  description: field("description"),
  productType: field("productType"),
  hasPhoto: sql<boolean>`${customOrderRequests.photoBase64} is not null`,
  createdAt: customOrderRequests.createdAt,
  deliveredAt: customOrderRequests.deliveredAt,
  attempts: customOrderRequests.attempts,
  lockedUntil: customOrderRequests.lockedUntil,
  archivedAt: customOrderRequests.archivedAt,
};
