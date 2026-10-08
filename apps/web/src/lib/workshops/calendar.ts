/** Событие «старт мастер-класса» для календаря покупателя. */
export interface ReleaseEvent {
  slug: string;
  title: string;
  releaseAt: Date;
  /** Куда ведёт событие: кабинет мастер-класса. */
  url: string;
}

const EVENT_MINUTES = 60;

/** 2026-11-01T07:00:00.000Z → 20261101T070000Z */
function icsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Экранирование текста по RFC 5545: \ ; , и переводы строк. */
function icsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function eventText(event: ReleaseEvent) {
  return {
    summary: `Старт мастер-класса «${event.title}» — Stariva`,
    description: `Уроки открываются в личном кабинете: ${event.url}`,
  };
}

/**
 * .ics с одним событием и напоминаниями за день и за час. Открывается
 * штатным календарём iPhone, Android и Outlook — без регистрации и приложений.
 */
export function buildReleaseIcs(event: ReleaseEvent): string {
  const end = new Date(event.releaseAt.getTime() + EVENT_MINUTES * 60_000);
  const { summary, description } = eventText(event);
  const alarm = (trigger: string) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(summary)}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
  ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stariva//Workshops//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:workshop-${event.slug}-release@stariva.ru`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.releaseAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${event.url}`,
    ...alarm("-P1D"),
    ...alarm("-PT1H"),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Ссылка «Добавить в Google Календарь» с заполненным событием. */
export function googleCalendarUrl(event: ReleaseEvent): string {
  const end = new Date(event.releaseAt.getTime() + EVENT_MINUTES * 60_000);
  const { summary, description } = eventText(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${icsDate(event.releaseAt)}/${icsDate(end)}`,
    details: description,
    ctz: "Europe/Moscow",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
