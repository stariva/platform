import type { VisitorInfo } from "@stariva/db/schema";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { visitorPlace } from "~/components/visitors/visitor-card";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Moscow",
});

export const LOGIN_PAGE_SIZE = 25;
export const MAX_LOGIN_LIMIT = 200;

type EventType = "sign_in" | "sign_in_failed" | "sign_out" | "password_reset";

const TYPE_LABELS: Record<EventType, string> = {
  sign_in: "Вход",
  sign_in_failed: "Неудачная попытка",
  sign_out: "Выход",
  password_reset: "Сброс пароля",
};

const TYPE_FILTERS: Array<{ value: EventType | undefined; label: string }> = [
  { value: undefined, label: "Все" },
  { value: "sign_in", label: "Входы" },
  { value: "sign_in_failed", label: "Неудачные" },
  { value: "sign_out", label: "Выходы" },
  { value: "password_reset", label: "Сбросы пароля" },
];

const METHOD_LABELS: Record<string, string> = {
  password: "Пароль",
  magic_link: "Ссылка из письма",
  email_otp: "Код из письма",
  email_verification: "Подтверждение почты",
};

const FAILURE_LABELS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Неверный email или пароль",
  INVALID_PASSWORD: "Неверный пароль",
  EMAIL_NOT_VERIFIED: "Почта не подтверждена",
  INVALID_OTP: "Неверный код",
  TOO_MANY_ATTEMPTS: "Слишком много попыток",
};

/** Часовой пояс браузера не совпал с поясом по IP: вероятно, VPN. Только подсказка. */
function looksLikeVpn(visitor: VisitorInfo | null) {
  return Boolean(
    visitor?.timezone &&
      visitor.ipTimezone &&
      visitor.timezone !== visitor.ipTimezone,
  );
}

function typeBadge(type: EventType) {
  if (type === "sign_in_failed")
    return <Badge variant="destructive">{TYPE_LABELS[type]}</Badge>;
  if (type === "sign_in") return <Badge>{TYPE_LABELS[type]}</Badge>;
  return <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>;
}

export interface LoginHistoryData {
  events: Array<{
    id: string;
    type: EventType;
    method: string | null;
    failureReason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    visitor: VisitorInfo | null;
    createdAt: Date;
    sessionActive: boolean;
    isNewIp: boolean;
  }>;
  total: number;
  summary: {
    signIns: number;
    uniqueIps: number;
    failedRecently: number;
    activeSessions: number;
    lastSignIn: {
      createdAt: Date;
      ipAddress: string | null;
      visitor: VisitorInfo | null;
    } | null;
  };
}

function href(userId: string, type: EventType | undefined, limit: number) {
  const params = new URLSearchParams();
  if (type) params.set("loginType", type);
  if (limit > LOGIN_PAGE_SIZE) params.set("logins", String(limit));
  const search = params.toString();
  return `/users/${encodeURIComponent(userId)}${search ? `?${search}` : ""}#logins`;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-base font-medium tabular-nums">{value}</div>
    </div>
  );
}

/** Журнал входов пользователя: сводка, фильтр по типу и таблица событий. */
export function UserLoginHistory({
  userId,
  data,
  type,
  limit,
}: {
  userId: string;
  data: LoginHistoryData;
  type: EventType | undefined;
  limit: number;
}) {
  const { events, total, summary } = data;
  const last = summary.lastSignIn;
  const lastPlace = last?.visitor ? visitorPlace(last.visitor) : null;

  return (
    <Card id="logins">
      <CardHeader>
        <CardTitle>Входы и авторизации</CardTitle>
        <p className="text-muted-foreground text-sm">
          Время по Москве. Журнал ведётся с момента его появления; записи старше
          года удаляются. Попытки входа с несуществующей почтой не сохраняются.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Stat
            label="Последний вход"
            value={
              last ? (
                <span className="text-sm font-normal">
                  {dateFormat.format(last.createdAt)}
                  <span className="text-muted-foreground block text-xs">
                    {[last.ipAddress, lastPlace].filter(Boolean).join(" · ") ||
                      "IP не определён"}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <Stat label="Всего входов" value={summary.signIns} />
          <Stat label="Разных IP" value={summary.uniqueIps} />
          <Stat
            label="Неудачных за 30 дней"
            value={
              summary.failedRecently > 0 ? (
                <span className="text-destructive">
                  {summary.failedRecently}
                </span>
              ) : (
                0
              )
            }
          />
          <Stat label="Активных сессий" value={summary.activeSessions} />
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Тип события">
          {TYPE_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={href(userId, filter.value, LOGIN_PAGE_SIZE)}
              className={buttonVariants({
                variant: filter.value === type ? "default" : "outline",
                size: "sm",
              })}
              aria-current={filter.value === type ? "true" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Событие</TableHead>
                <TableHead>Способ</TableHead>
                <TableHead>IP-адрес</TableHead>
                <TableHead>Место</TableHead>
                <TableHead>Устройство</TableHead>
                <TableHead>Сессия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-6 text-center"
                  >
                    Записей нет
                  </TableCell>
                </TableRow>
              )}
              {events.map((event) => {
                const visitor = event.visitor;
                const place = visitor ? visitorPlace(visitor) : null;
                const device = [
                  visitor?.deviceModel,
                  visitor?.os,
                  visitor?.browser,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <TableRow key={event.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateFormat.format(event.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {typeBadge(event.type)}
                      {event.failureReason && (
                        <div className="text-muted-foreground mt-1 text-xs">
                          {FAILURE_LABELS[event.failureReason] ??
                            event.failureReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(event.method && METHOD_LABELS[event.method]) || "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-mono text-sm">
                        {event.ipAddress ?? "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {event.isNewIp && (
                          <Badge variant="outline">новый IP</Badge>
                        )}
                        {looksLikeVpn(visitor) && (
                          <Badge
                            variant="outline"
                            title="Часовой пояс браузера не совпал с поясом по IP"
                          >
                            возможен VPN
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm whitespace-normal">
                      {place ?? "—"}
                      {visitor?.isp && (
                        <div className="text-muted-foreground text-xs">
                          {visitor.isp}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[240px] text-sm whitespace-normal"
                      title={event.userAgent ?? undefined}
                    >
                      {device || "—"}
                      {visitor?.device && (
                        <div className="text-muted-foreground text-xs">
                          {visitor.device}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.type === "sign_in" ? (
                        event.sessionActive ? (
                          <Badge variant="secondary">активна</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            завершена
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Показано {events.length} из {total}
          </span>
          {total > events.length && limit < MAX_LOGIN_LIMIT && (
            <Link
              href={href(userId, type, limit + LOGIN_PAGE_SIZE)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Показать ещё
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
