import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, Circle, CircleCheck } from "lucide-react";
import { useCallback } from "react";
import { CraftHlsPlayer, type ProgressSnapshot } from "@/components/CraftHlsPlayer";
import { absoluteUrl, api, errorMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";

interface LessonScreenProps {
  slug: string;
  lessonId: string;
  onSelectLesson: (lessonId: string) => void;
  onBack: () => void;
}

/** Экран видеоурока с плеером и списком уроков. */
export function LessonScreen(props: LessonScreenProps) {
  return <LessonContent key={`${props.slug}:${props.lessonId}`} {...props} />;
}

function LessonContent({
  slug,
  lessonId,
  onSelectLesson,
  onBack,
}: LessonScreenProps) {
  const details = useQuery({
    queryKey: ["lesson", slug, lessonId],
    queryFn: () => api.account.lessonDetails({ slug, lessonId }),
  });

  const video = useQuery({
    queryKey: ["lesson-video", slug, lessonId],
    queryFn: () => api.account.lessonVideo({ slug, lessonId }),
    // Ссылка временная: обновляем её сами, когда плеер просит (401/403)
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });

  // Прогресс шлём «выстрелил и забыл»: если сети нет, плеер сохранил копию
  // локально и при следующем запуске продолжит с неё
  const saveProgress = useCallback(
    (progress: ProgressSnapshot) => {
      api.account
        .saveLessonProgress(
          { slug, lessonId, ...progress },
          { context: { keepalive: true } },
        )
        .catch(() => {});
    },
    [slug, lessonId],
  );

  const refreshVideo = useCallback(() => {
    void video.refetch();
  }, [video.refetch]);

  if (details.isError || video.isError) {
    const error = details.error ?? video.error;
    return (
      <Shell onBack={onBack}>
        <p className="p-6 text-center text-muted">
          {errorMessage(error, "Не получилось открыть урок")}
        </p>
        <div className="px-6">
          <button
            type="button"
            onClick={() => {
              void details.refetch();
              void video.refetch();
            }}
            className="min-h-12 w-full rounded-2xl bg-accent font-medium text-accent-fg"
          >
            Повторить
          </button>
        </div>
      </Shell>
    );
  }

  if (!details.data || !video.data) {
    return (
      <Shell onBack={onBack}>
        <div className="aspect-video animate-pulse bg-surface" />
      </Shell>
    );
  }

  const lesson = details.data;
  const currentIndex = lesson.lessons.findIndex((item) => item.id === lessonId);
  const nextLesson = lesson.lessons[currentIndex + 1];

  return (
    <Shell onBack={onBack} title={lesson.title}>
      <div className="px-4 pb-3">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">
          {lesson.workshopTitle}
        </p>
        <p className="mt-1 text-sm text-muted">
          Урок {currentIndex + 1} из {lesson.lessons.length}
        </p>
      </div>
      {/* Плеер остаётся на месте, пока листаешь уроки */}
      <div className="sticky top-0 z-10 border-b border-line bg-bg">
        <CraftHlsPlayer
          // Другой урок — новый плеер: прогресс не должен перепутаться
          key={lessonId}
          src={{
            url: absoluteUrl(video.data.url),
            type: video.data.type,
          }}
          startAt={lesson.positionSeconds}
          progressKey={`${slug}:${lessonId}`}
          onSaveProgress={saveProgress}
          onSourceExpired={refreshVideo}
        />
      </div>

      <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <LessonList
          lessons={lesson.lessons}
          currentId={lessonId}
          onSelect={onSelectLesson}
        />
        {nextLesson && (
          <button
            type="button"
            onClick={() => onSelectLesson(nextLesson.id)}
            className="mt-8 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-accent px-4 text-left font-semibold text-accent-fg"
          >
            <span>Следующий урок: {nextLesson.title}</span>
            <ArrowRight size={20} className="shrink-0" />
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  title,
  onBack,
  children,
}: {
  title?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="flex size-12 items-center justify-center rounded-2xl active:bg-surface"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </header>
      {children}
    </div>
  );
}

function LessonList({
  lessons,
  currentId,
  onSelect,
}: {
  lessons: {
    id: string;
    title: string;
    durationSeconds: number;
    completed: boolean;
  }[];
  currentId: string;
  onSelect: (lessonId: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentId;
        return (
          <li key={lesson.id}>
            <button
              type="button"
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => onSelect(lesson.id)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left ${
                isCurrent
                  ? "bg-accent text-accent-fg"
                  : "bg-surface ring-1 ring-line"
              }`}
            >
              {lesson.completed ? (
                <CircleCheck className="size-6 shrink-0" aria-label="Пройден" />
              ) : (
                <Circle className="size-6 shrink-0 opacity-50" aria-hidden />
              )}
              <span className="flex-1 font-medium">
                {index + 1}. {lesson.title}
              </span>
              <span className="text-sm tabular-nums opacity-70">
                {formatTime(lesson.durationSeconds)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
