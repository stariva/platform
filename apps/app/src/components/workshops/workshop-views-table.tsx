import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "Europe/Moscow",
});

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export interface WorkshopViewRow {
  viewer: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  workshopSlug: string;
  workshopTitle: string | null;
  lessonId: string;
  lessonTitle: string | null;
  lessonPosition: number | null;
  lessonsCount: number | null;
  firstAt: Date;
  lastAt: Date;
  ips: string[];
  userAgent: string | null;
  progress: {
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
  } | null;
}

/** Коротко об устройстве из User-Agent: «iPhone · Safari». */
export function deviceLabel(userAgent: string | null) {
  if (!userAgent) return null;
  const os = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : null;
  const browser = /YaBrowser/.test(userAgent)
    ? "Яндекс Браузер"
    : /Edg\//.test(userAgent)
      ? "Edge"
      : /OPR\//.test(userAgent)
        ? "Opera"
        : /Firefox|FxiOS/.test(userAgent)
          ? "Firefox"
          : /Chrome|CriOS/.test(userAgent)
            ? "Chrome"
            : /Safari/.test(userAgent)
              ? "Safari"
              : null;
  return [os, browser].filter(Boolean).join(" · ") || null;
}

function minutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Progress({ progress }: { progress: WorkshopViewRow["progress"] }) {
  if (!progress) return <span className="text-muted-foreground">—</span>;
  if (progress.completed) return <Badge>досмотрен</Badge>;
  const percent = Math.min(
    100,
    Math.round((progress.positionSeconds / progress.durationSeconds) * 100),
  );
  return (
    <div className="w-28">
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-muted-foreground mt-1 text-xs tabular-nums">
        {minutes(progress.positionSeconds)} из{" "}
        {minutes(progress.durationSeconds)}
      </div>
    </div>
  );
}

/** Просмотры уроков: кто, какой урок, когда смотрел и докуда дошёл. */
export function WorkshopViewsTable({
  rows,
  showWorkshop,
}: {
  rows: WorkshopViewRow[];
  showWorkshop: boolean;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Кто</TableHead>
            <TableHead>Урок</TableHead>
            <TableHead>Когда</TableHead>
            <TableHead>Прогресс</TableHead>
            <TableHead>Откуда</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                Просмотров нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const sameMinute =
              timeFormat.format(row.firstAt) === timeFormat.format(row.lastAt);
            return (
              <TableRow
                key={`${row.viewer}:${row.lessonId}:${row.firstAt.toISOString()}`}
              >
                <TableCell className="max-w-[280px] align-top whitespace-normal">
                  {row.userId ? (
                    <>
                      <Link
                        href={`/users/${row.userId}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {row.userName ?? "Без имени"}
                      </Link>
                      <div className="text-muted-foreground text-xs break-all">
                        {row.userEmail}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium">Гость</div>
                      <div className="text-muted-foreground text-xs">
                        без входа в аккаунт
                      </div>
                    </>
                  )}
                </TableCell>
                <TableCell className="max-w-[320px] align-top text-sm whitespace-normal">
                  {row.lessonPosition !== null && (
                    <span className="text-muted-foreground tabular-nums">
                      {row.lessonPosition}
                      {row.lessonsCount ? `/${row.lessonsCount}` : ""}.{" "}
                    </span>
                  )}
                  {row.lessonTitle ?? (
                    <span className="text-muted-foreground">
                      урок удалён ({row.lessonId})
                    </span>
                  )}
                  {showWorkshop && (
                    <div className="text-muted-foreground text-xs">
                      {row.workshopTitle ?? row.workshopSlug}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm whitespace-nowrap">
                  {dayFormat.format(row.firstAt)}
                  <div className="text-muted-foreground text-xs tabular-nums">
                    {sameMinute
                      ? timeFormat.format(row.firstAt)
                      : `${timeFormat.format(row.firstAt)}–${timeFormat.format(row.lastAt)}`}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Progress progress={row.progress} />
                </TableCell>
                <TableCell
                  className="max-w-[240px] align-top text-sm whitespace-normal"
                  title={row.userAgent ?? undefined}
                >
                  {deviceLabel(row.userAgent) ?? "—"}
                  <div className="text-muted-foreground text-xs break-all">
                    {row.ips.length > 0 ? row.ips.join(", ") : "IP не определён"}
                  </div>
                  {row.ips.length > 1 && (
                    <Badge
                      variant="outline"
                      className="mt-1"
                      title="За день урок открывали с разных IP"
                    >
                      несколько IP
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
