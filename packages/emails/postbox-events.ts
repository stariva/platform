/**
 * Разбор уведомлений Postbox из потока Data Streams. Формат:
 * https://yandex.cloud/ru/docs/postbox/concepts/notification
 */

/** Событие письма, готовое лечь в email_events. */
export interface PostboxEvent {
  eventId: string;
  messageId: string;
  type: string;
  recipients: string[];
  occurredAt: Date;
  payload: Record<string, unknown>;
}

/** Поле с подробностями у каждого типа события. */
const DETAIL_FIELDS: Record<string, string> = {
  Send: "send",
  "Rendering Failure": "failure",
  Delivery: "delivery",
  DeliveryDelay: "deliveryDelay",
  Bounce: "bounce",
  Complaint: "complaint",
  Open: "open",
  Click: "click",
  Subscription: "subscription",
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

function date(value: unknown): Date | null {
  const at = text(value);
  if (!at) return null;
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Адреса из delivery.recipients или из списка объектов с emailAddress. */
function recipientsOf(detail: Json | null): string[] {
  if (!detail) return [];
  const lists = [
    detail.recipients,
    detail.bouncedRecipients,
    detail.complainedRecipients,
    detail.delayedRecipients,
  ];
  const emails = lists.flatMap((list) =>
    Array.isArray(list)
      ? list.map((item) => text(isObject(item) ? item.emailAddress : item))
      : [],
  );
  return [
    ...new Set(emails.filter((email): email is string => email !== null)),
  ].map((email) => email.toLowerCase());
}

/**
 * Уведомление Postbox → событие для базы. Без eventId, messageId или типа
 * событие не к чему привязать — null. Заголовки письма (mail.headers) не
 * храним: в них личные ссылки, например List-Unsubscribe.
 */
export function parsePostboxEvent(raw: unknown): PostboxEvent | null {
  if (!isObject(raw) || !isObject(raw.mail)) return null;
  const eventId = text(raw.eventId);
  const type = text(raw.eventType);
  const messageId = text(raw.mail.messageId);
  if (!eventId || !type || !messageId) return null;

  const field = DETAIL_FIELDS[type];
  const detail = field && isObject(raw[field]) ? (raw[field] as Json) : null;
  const occurredAt =
    date(detail?.timestamp) ?? date(raw.mail.timestamp) ?? new Date();
  const { headers: _headers, ...mail } = raw.mail;
  return {
    eventId,
    messageId,
    type,
    recipients: recipientsOf(detail),
    occurredAt,
    payload: { ...raw, mail },
  };
}

/**
 * Записи потока → события. В записи обычно одно уведомление JSON, но на
 * случай пачки читаем и построчно. Нераспознанное возвращаем отдельно, чтобы
 * записать в лог, а не застрять на нём.
 */
export function parseStreamRecord(data: string): {
  events: PostboxEvent[];
  rejected: number;
} {
  const chunks = (() => {
    try {
      return [JSON.parse(data) as unknown];
    } catch {
      return data
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as unknown;
          } catch {
            return null;
          }
        });
    }
  })();
  const items = chunks.flatMap((chunk) =>
    Array.isArray(chunk) ? chunk : [chunk],
  );
  const events = items
    .map(parsePostboxEvent)
    .filter((event): event is PostboxEvent => event !== null);
  return { events, rejected: items.length - events.length };
}

/**
 * Каких адресатов события больше не беспокоить рассылками: ящик не
 * существует (постоянный отказ) или на письмо пожаловались. Жалоба с типом
 * not-spam — наоборот, «это не спам», её пропускаем.
 */
export function suppressionsOf(
  event: PostboxEvent,
): { email: string; reason: "bounced" | "complained" }[] {
  const detail = event.payload[DETAIL_FIELDS[event.type] ?? ""];
  if (event.type === "Bounce") {
    const permanent = isObject(detail) && detail.bounceType === "Permanent";
    return permanent
      ? event.recipients.map((email) => ({ email, reason: "bounced" }))
      : [];
  }
  if (event.type === "Complaint") {
    const notSpam =
      isObject(detail) && detail.complaintFeedbackType === "not-spam";
    return notSpam
      ? []
      : event.recipients.map((email) => ({ email, reason: "complained" }));
  }
  return [];
}
