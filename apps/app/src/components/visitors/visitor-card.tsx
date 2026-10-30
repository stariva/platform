import type { VisitorInfo } from "@stariva/db/schema";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@stariva/ui";

export type { VisitorInfo };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Moscow",
});

/** «Лотошино, Московская область, Россия»; null, если места нет. */
export function visitorPlace(visitor: VisitorInfo): string | null {
  const parts = [
    visitor.city,
    visitor.region,
    visitor.country ?? visitor.countryCode,
  ].filter((part, index, all): part is string =>
    Boolean(part && all.indexOf(part) === index),
  );
  return parts.length ? parts.join(", ") : null;
}

/** Loopback и частные сети: запрос шёл не из интернета (чаще всего dev-сервер). */
export function isLocalIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  if (lower.startsWith("fe80")) return true;
  const [a = 0, b = 0] = lower.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Часовой пояс браузера не совпал с поясом по IP — вероятно, VPN или прокси.
 * Сравниваем строки как есть: у пары Europe/Kiev и Europe/Kyiv возможны
 * ложные срабатывания, поэтому это подсказка, а не вывод.
 */
function timezoneMismatch(visitor: VisitorInfo) {
  return Boolean(
    visitor.timezone &&
      visitor.ipTimezone &&
      visitor.timezone !== visitor.ipTimezone,
  );
}

/** Всё, что сервер узнал о покупателе или отправителе в момент оформления. */
export function VisitorCard({ visitor }: { visitor: VisitorInfo | null }) {
  if (!visitor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Откуда пришёл</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Данных нет: оформлено до того, как сайт начал их собирать.
        </CardContent>
      </Card>
    );
  }

  const place = visitorPlace(visitor);
  const coordinates =
    visitor.latitude !== undefined && visitor.longitude !== undefined
      ? `${visitor.latitude}, ${visitor.longitude}`
      : null;
  const device = [visitor.deviceModel, visitor.os, visitor.browser]
    .filter(Boolean)
    .join(", ");
  const rows: Array<[string, React.ReactNode]> = [
    [
      "IP-адрес",
      visitor.ip ? (
        <>
          {visitor.ip}
          {isLocalIp(visitor.ip) && (
            <span className="text-muted-foreground">
              {" "}
              — локальный адрес: запрос шёл не из интернета, город и провайдера
              по нему не узнать
            </span>
          )}
        </>
      ) : (
        "не определён"
      ),
    ],
    [
      "Город",
      place ? (
        <>
          {place}
          {visitor.postalCode && ` · ${visitor.postalCode}`}
        </>
      ) : (
        "не определён"
      ),
    ],
    [
      "Координаты по IP",
      coordinates && (
        <a
          href={`https://yandex.ru/maps/?pt=${visitor.longitude},${visitor.latitude}&z=10&l=map`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {coordinates}
        </a>
      ),
    ],
    [
      "Провайдер",
      visitor.isp && `${visitor.isp}${visitor.asn ? ` (${visitor.asn})` : ""}`,
    ],
    [
      "Часовой пояс",
      visitor.timezone || visitor.ipTimezone ? (
        <>
          браузер: {visitor.timezone ?? "—"} · по IP:{" "}
          {visitor.ipTimezone ?? "—"}
          {timezoneMismatch(visitor) && (
            <Badge variant="destructive" className="ml-2">
              не совпадают, возможен VPN
            </Badge>
          )}
        </>
      ) : null,
    ],
    [
      "Устройство",
      device && (
        <>
          {device}
          {visitor.device && ` · ${visitor.device}`}
        </>
      ),
    ],
    [
      "Экран",
      visitor.screen &&
        `${visitor.screen}${visitor.viewport ? `, окно ${visitor.viewport}` : ""}${visitor.pixelRatio ? `, ×${visitor.pixelRatio}` : ""}`,
    ],
    ["Язык", visitor.languages ?? visitor.language],
    [
      "Оформлено со страницы",
      visitor.page &&
        `${visitor.page}${visitor.referrer ? ` (пришёл с ${visitor.referrer})` : ""}`,
    ],
    ["Время запроса", dateFormat.format(new Date(visitor.at))],
    ["User-Agent", visitor.userAgent],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Откуда пришёл</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
        </dl>
        {visitor.geoSource === "lookup" && (
          <p className="text-muted-foreground mt-3 text-xs">
            Город определён по IP приблизительно: обычно точно до города, но у
            мобильных операторов и VPN может быть другим.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
