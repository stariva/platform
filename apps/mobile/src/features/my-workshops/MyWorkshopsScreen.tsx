import type { MobileCourse } from "@stariva/web-api/contract";
import { ArrowRight, BookOpen, CalendarDays, WifiOff } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ProgressBar,
  SegmentedControl,
  Skeleton,
} from "@/components/ui/Primitives";
import { API_URL } from "@/lib/api";
import type { Booking } from "@/api/schemas";
import { useBookings, useMyCourses } from "./queries";

type Segment = "upcoming" | "past" | "materials" | "cancelled";
const segments = [
  { id: "upcoming", label: "Предстоящие" },
  { id: "past", label: "Прошедшие" },
  { id: "materials", label: "Записи и материалы" },
  { id: "cancelled", label: "Отменённые" },
] as const;
const imageUrl = (cover: string) =>
  /^https?:\/\//.test(cover)
    ? cover
    : `${API_URL || "https://stariva.ru"}${cover.startsWith("/") ? "" : "/"}${cover}`;

export function MyWorkshopsScreen({
  userId,
  name,
  onCatalog,
  onCourse,
  favoriteCount,
  onBooking,
}: {
  userId: string | null;
  name: string;
  onCatalog: () => void;
  onCourse: (course: MobileCourse) => void;
  favoriteCount: number;
  onBooking: (booking: Booking) => void;
}) {
  const [segment, setSegment] = useState<Segment>("upcoming");
  const courses = useMyCourses(userId);
  const bookings = useBookings();
  const upcoming =
    bookings.data?.filter(
      (booking) =>
        booking.status === "confirmed" || booking.status === "pending_payment",
    ) ?? [];
  const completed =
    courses.data?.courses.filter(
      (course) =>
        course.lessonCount > 0 && course.completedLessons >= course.lessonCount,
    ).length ?? 0;
  return (
    <main className="screen">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.2em] text-accent">
            Личный кабинет
          </span>
          <h1 className="display mt-3">Мои мастер-классы</h1>
          <p className="mt-3 text-sm text-muted">
            Здравствуйте, {name || "друг"}.
          </p>
        </div>
        <Avatar name={name || "Stariva"} />
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2">
        {[
          [String(upcoming.length), "Предстоит"],
          [String(completed), "Пройдено"],
          [String(favoriteCount), "Избранное"],
        ].map(([count, label]) => (
          <div
            key={label}
            className="rounded-[var(--radius-lg)] bg-surface p-3 text-center shadow-[var(--shadow-1)]"
          >
            <strong className="block font-display text-3xl">{count}</strong>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
      {!navigator.onLine && (
        <p className="mt-5 flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-soft p-3 text-sm">
          <WifiOff size={18} />
          Нет сети. Показываем сохранённые курсы, если они есть.
        </p>
      )}
      <div className="mt-7">
        <SegmentedControl
          items={segments}
          value={segment}
          onChange={setSegment}
        />
      </div>
      {segment === "materials" ? (
        <section className="mt-6">
          <h2 className="section-title">Ваши курсы</h2>
          {courses.isLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : courses.isError ? (
            <div className="mt-4">
              <ErrorState
                message="Не удалось загрузить курсы. Проверьте соединение."
                onRetry={() => void courses.refetch()}
              />
            </div>
          ) : courses.data?.courses.length ? (
            <div className="mt-4 space-y-3">
              {courses.data.courses.map((course) => (
                <button
                  key={course.slug}
                  type="button"
                  onClick={() => onCourse(course)}
                  className="flex min-h-32 w-full gap-4 rounded-[var(--radius-lg)] bg-surface p-3 text-left shadow-[var(--shadow-1)]"
                >
                  <img
                    src={imageUrl(course.cover)}
                    alt=""
                    className="size-28 shrink-0 rounded-[var(--radius-md)] object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <Badge>Онлайн</Badge>
                    <strong className="mt-2 block font-display text-[1.6rem] leading-none">
                      {course.title}
                    </strong>
                    <span className="mt-2 block text-xs text-muted">
                      {course.completedLessons} из {course.lessonCount} уроков
                    </span>
                    <span className="mt-2 block">
                      <ProgressBar
                        value={
                          course.lessonCount
                            ? (course.completedLessons / course.lessonCount) *
                              100
                            : 0
                        }
                      />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="Пока нет курсов"
                description="Приобретённые мастер-классы появятся здесь вместе с уроками и материалами."
                action={<Button onClick={onCatalog}>Найти мастер-класс</Button>}
              />
            </div>
          )}
        </section>
      ) : segment === "upcoming" ? (
        <section className="mt-6">
          <h2 className="section-title">Ближайший мастер-класс</h2>
          {bookings.isLoading ? (
            <Skeleton className="mt-4 h-48" />
          ) : bookings.isError ? (
            <div className="mt-4">
              <ErrorState
                message="Не удалось загрузить записи."
                onRetry={() => void bookings.refetch()}
              />
            </div>
          ) : upcoming.length ? (
            <div className="mt-4 space-y-3">
              {upcoming.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onBooking(booking)}
                  className="w-full overflow-hidden rounded-[var(--radius-xl)] bg-surface text-left shadow-[var(--shadow-1)]"
                >
                  <img
                    src={booking.image}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                  />
                  <span className="block p-4">
                    <Badge>
                      {booking.status === "confirmed"
                        ? "Подтверждена"
                        : "Ожидает оплаты"}
                    </Badge>
                    <strong className="mt-2 block font-display text-[1.8rem] leading-none">
                      {booking.title}
                    </strong>
                    <span className="mt-2 block text-sm text-muted">
                      {new Intl.DateTimeFormat("ru-RU", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(booking.startsAt))}{" "}
                      · {booking.seats} место
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {booking.address}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="Пока нет записи"
                description="Записи на занятия с датой и билетом появятся здесь, когда они станут доступны в Stariva."
                action={
                  <Button onClick={onCatalog}>
                    <CalendarDays size={18} />
                    Найти мастер-класс
                  </Button>
                }
              />
            </div>
          )}
          {courses.data?.resume && (
            <div className="mt-7">
              <h2 className="section-title">Продолжить плетение</h2>
              <p className="mt-2 text-sm text-muted">
                {courses.data.resume.workshopTitle} ·{" "}
                {courses.data.resume.lessonTitle}
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  const course = courses.data?.courses.find(
                    (item) => item.slug === courses.data?.resume?.slug,
                  );
                  if (course) onCourse(course);
                }}
              >
                Открыть курс <ArrowRight size={18} />
              </Button>
            </div>
          )}
        </section>
      ) : (
        <div className="mt-6">
          <EmptyState
            title={
              segment === "past"
                ? "Пока нет завершённых занятий"
                : "Нет отменённых записей"
            }
            description={
              segment === "past"
                ? "Пройденные занятия с датой появятся здесь. Завершённые онлайн-курсы доступны в материалах."
                : "Здесь будут отменённые записи, когда появится возможность бронирования."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => setSegment("materials")}
              >
                <BookOpen size={18} />
                Мои курсы
              </Button>
            }
          />
        </div>
      )}
    </main>
  );
}
