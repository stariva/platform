import type { MobileCourse } from "@stariva/web-api/contract";
import { ArrowRight, Play, WifiOff } from "lucide-react";
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
import { useMyCourses } from "./queries";

type Segment = "all" | "in-progress" | "completed";
const segments = [
  { id: "all", label: "Все" },
  { id: "in-progress", label: "Смотрю" },
  { id: "completed", label: "Завершены" },
] as const;
const imageUrl = (cover: string) =>
  /^https?:\/\//.test(cover)
    ? cover
    : `${API_URL}${cover.startsWith("/") ? "" : "/"}${cover}`;

export function MyWorkshopsScreen({
  userId,
  name,
  onCatalog,
  onCourse,
  onPlayCourse,
  favoriteCount,
}: {
  userId: string | null;
  name: string;
  onCatalog: () => void;
  onCourse: (course: MobileCourse) => void;
  onPlayCourse: (course: MobileCourse, lessonId: string) => void;
  favoriteCount: number;
}) {
  const [segment, setSegment] = useState<Segment>("all");
  const courses = useMyCourses(userId);
  const owned = courses.data?.courses ?? [];
  const resume = courses.data?.resume;
  const resumeCourse = owned.find((course) => course.slug === resume?.slug);
  const completed = owned.filter(
    (course) =>
      course.lessonCount > 0 && course.completedLessons >= course.lessonCount,
  ).length;
  const visible = owned.filter((course) => {
    if (segment === "all") return true;
    const done =
      course.lessonCount > 0 && course.completedLessons >= course.lessonCount;
    return segment === "completed" ? done : !done;
  });

  return (
    <main className="screen">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.2em] text-accent">
            Ваша видеотека
          </span>
          <h1 className="display mt-3">Мои мастер-классы</h1>
          <p className="mt-3 text-sm text-muted">
            Здравствуйте, {name || "друг"}. Уроки всегда под рукой.
          </p>
        </div>
        <Avatar name={name || "Stariva"} />
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2">
        {[
          [String(owned.length), "Мои курсы"],
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
          <WifiOff size={18} /> Нет сети. Список курсов доступен, видео требует
          подключения.
        </p>
      )}
      {resume && resumeCourse && (
        <section className="mt-8">
          <h2 className="section-title">Продолжить просмотр</h2>
          <button
            type="button"
            onClick={() => onPlayCourse(resumeCourse, resume.lessonId)}
            className="relative mt-4 w-full overflow-hidden rounded-[var(--radius-xl)] bg-black text-left text-white shadow-[var(--shadow-2)]"
          >
            <img
              src={imageUrl(resumeCourse.cover)}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-35"
            />
            <span className="relative block bg-gradient-to-t from-black/80 to-transparent p-5 pt-24">
              <span className="text-xs font-bold uppercase tracking-[.16em]">
                {resume.workshopTitle}
              </span>
              <strong className="mt-2 block font-display text-3xl leading-none">
                {resume.lessonTitle}
              </strong>
              <span className="mt-5 flex items-center gap-2 font-semibold">
                <Play size={19} fill="currentColor" /> Смотреть дальше
              </span>
            </span>
          </button>
        </section>
      )}
      <section className="mt-9">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Купленные курсы</h2>
          <Button variant="ghost" onClick={onCatalog}>
            Найти ещё <ArrowRight size={18} />
          </Button>
        </div>
        <div className="mt-4">
          <SegmentedControl
            items={segments}
            value={segment}
            onChange={setSegment}
          />
        </div>
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
        ) : visible.length ? (
          <div className="mt-4 space-y-3">
            {visible.map((course) => {
              const playLessonId =
                resume?.slug === course.slug
                  ? resume.lessonId
                  : course.firstLessonId;
              return (
                <div
                  key={course.slug}
                  className="rounded-[var(--radius-lg)] bg-surface p-3 shadow-[var(--shadow-1)]"
                >
                  <button
                    type="button"
                    onClick={() => onCourse(course)}
                    className="flex w-full gap-4 text-left"
                  >
                    <img
                      src={imageUrl(course.cover)}
                      alt=""
                      className="size-24 shrink-0 rounded-[var(--radius-md)] object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <Badge>Видеокурс</Badge>
                      <strong className="mt-2 block font-display text-[1.5rem] leading-none">
                        {course.title}
                      </strong>
                      <span className="mt-2 block text-xs text-muted">
                        {course.completedLessons} из {course.lessonCount} уроков
                      </span>
                    </span>
                  </button>
                  <div className="mt-3">
                    <ProgressBar
                      value={
                        course.lessonCount
                          ? (course.completedLessons / course.lessonCount) * 100
                          : 0
                      }
                    />
                  </div>
                  {playLessonId && (
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      onClick={() => onPlayCourse(course, playLessonId)}
                    >
                      <Play size={18} />
                      {resume?.slug === course.slug
                        ? "Продолжить"
                        : "Смотреть уроки"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={
                owned.length ? "Здесь пока пусто" : "Ваши курсы появятся здесь"
              }
              description={
                owned.length
                  ? "Выберите другую вкладку."
                  : "Выберите видеокурс и смотрите уроки в удобное время."
              }
              action={<Button onClick={onCatalog}>Выбрать видеокурс</Button>}
            />
          </div>
        )}
      </section>
    </main>
  );
}
