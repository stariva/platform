import {
  Badge,
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import {
  formatDurationLabel,
  WORKSHOP_CATEGORIES,
  WORKSHOP_LEVELS,
  WORKSHOP_STATUS_LABELS,
} from "@stariva/validators";
import Link from "next/link";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const statusVariant = {
  published: "default",
  draft: "secondary",
  archived: "outline",
} as const;

export default async function WorkshopsPage() {
  const workshops = await api.admin.workshops.list();

  return (
    <>
      <SiteHeader title="Мастер-классы" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Мастер-классы
            </h1>
            <p className="text-muted-foreground text-sm">
              {workshops.length} всего · на сайте{" "}
              {workshops.filter((w) => w.status === "published").length}
            </p>
          </div>
          <Link href="/workshops/new" className={buttonVariants()}>
            Добавить мастер-класс
          </Link>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20" />
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Уроки</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Порядок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workshops.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Мастер-классов пока нет
                  </TableCell>
                </TableRow>
              )}
              {workshops.map((workshop) => (
                <TableRow key={workshop.id}>
                  <TableCell>
                    {workshop.cover ? (
                      // biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации
                      <img
                        src={workshop.cover}
                        alt=""
                        className="h-10 w-16 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="bg-muted h-10 w-16 rounded" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[360px]">
                    <Link
                      href={`/workshops/${workshop.id}`}
                      className="line-clamp-2 font-medium whitespace-normal hover:underline"
                    >
                      {workshop.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {workshop.slug}
                      {workshop.featured && " · популярный"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {WORKSHOP_CATEGORIES[workshop.category]}
                    <div className="text-muted-foreground text-xs">
                      {WORKSHOP_LEVELS[workshop.level]}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {workshop.lessonsCount}
                    {workshop.durationSeconds > 0 &&
                      ` · ${formatDurationLabel(workshop.durationSeconds)}`}
                    {workshop.withoutVideo > 0 && (
                      <div className="text-destructive text-xs">
                        без видео: {workshop.withoutVideo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {workshop.price === 0
                      ? "Бесплатно"
                      : rub.format(workshop.price)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[workshop.status]}>
                      {WORKSHOP_STATUS_LABELS[workshop.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {workshop.sortOrder}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
