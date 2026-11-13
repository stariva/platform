import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Circle, CircleCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CraftHlsPlayer,
  type CraftHlsPlayerHandle,
  type ProgressSnapshot,
} from "@/components/CraftHlsPlayer";
import { absoluteUrl, api, errorMessage } from "@/lib/api";
import { activeChapterIndex, formatTime } from "@/lib/format";

type Tab = "chapters" | "checklist" | "lessons";

const TABS: { id: Tab; label: string }[] = [
  { id: "chapters", label: "Таймкоды" },
  { id: "checklist", label: "Нарезка" },
  { id: "lessons", label: "Уроки" },
];

/** Пауза после последней отметки, чтобы не слать запрос на каждый тап. */
const CHECKLIST_SAVE_DELAY_MS = 600;

interface LessonScreenProps {
  slug: string;
  lessonId: string;
  onSelectLesson: (lessonId: string) => void;
  onBack: () => void;
}

/**
 * Экран урока: липкий плеер сверху, под ним вкладки с таймкодами-главами,
 * чек-листом нарезки шнура и списком уроков курса. Тёмная тема включена
 * всегда: экран смотрят подолгу, а свет от телефона не должен слепить.
 */
export function LessonScreen({
  slug,
  lessonId,
  onSelectLesson,
  onBack,
}: LessonScreenProps) {
  const playerRef = useRef<CraftHlsPlayerHandle>(null);
  const [tab, setTab] = useState<Tab>("chapters");
  const [time, setTime] = useState(0);

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
  const activeChapter = activeChapterIndex(lesson.chapters, time);

  return (
    <Shell onBack={onBack} title={lesson.title}>
      {/* Плеер остаётся на месте, пока листаешь вкладки */}
      <div className="sticky top-0 z-10 border-b border-line bg-bg">
        <CraftHlsPlayer
          // Другой урок — новый плеер: прогресс не должен перепутаться
          key={lessonId}
          ref={playerRef}
          src={{
            url: absoluteUrl(video.data.url),
            type: video.data.type,
          }}
          startAt={lesson.positionSeconds}
          progressKey={`${slug}:${lessonId}`}
          onSaveProgress={saveProgress}
          onTimeUpdate={setTime}
          onSourceExpired={refreshVideo}
        />
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-2 px-4 pt-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-12 rounded-2xl text-sm font-semibold ${
              tab === id
                ? "bg-fg text-bg"
                : "bg-surface text-muted ring-1 ring-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {tab === "chapters" && (
          <ChapterList
            chapters={lesson.chapters}
            active={activeChapter}
            onSelect={(seconds) => playerRef.current?.seekTo(seconds)}
          />
        )}
        {tab === "checklist" && (
          <MaterialsChecklist
            // Отметки привязаны к уроку: при смене урока список начинается заново
            key={lessonId}
            slug={slug}
            lessonId={lessonId}
            items={lesson.checklist}
            initiallyChecked={lesson.checkedMaterials}
          />
        )}
        {tab === "lessons" && (
          <LessonList
            lessons={lesson.lessons}
            currentId={lessonId}
            onSelect={onSelectLesson}
          />
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
    <div className="theme-dark min-h-dvh bg-bg text-fg">
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

function ChapterList({
  chapters,
  active,
  onSelect,
}: {
  chapters: { time: number; title: string }[];
  active: number;
  onSelect: (seconds: number) => void;
}) {
  if (chapters.length === 0) {
    return <Empty>Для этого урока таймкодов пока нет</Empty>;
  }
  return (
    <ul className="space-y-2">
      {chapters.map((chapter, index) => {
        const isActive = index === active;
        return (
          <li key={chapter.time}>
            <button
              type="button"
              aria-current={isActive ? "step" : undefined}
              onClick={() => onSelect(chapter.time)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left ${
                isActive
                  ? "bg-accent text-accent-fg"
                  : "bg-surface ring-1 ring-line"
              }`}
            >
              <span className="w-12 shrink-0 font-semibold tabular-nums">
                {formatTime(chapter.time)}
              </span>
              <span className="font-medium">{chapter.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MaterialsChecklist({
  slug,
  lessonId,
  items,
  initiallyChecked,
}: {
  slug: string;
  lessonId: string;
  items: { id: string; label: string }[];
  initiallyChecked: string[];
}) {
  const [checked, setChecked] = useState(() => new Set(initiallyChecked));
  const timer = useRef<number | undefined>(undefined);
  // Что ушло на сервер, чтобы не слать одно и то же при выходе
  const pending = useRef<string[] | null>(null);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const checkedMaterials = pending.current;
    if (!checkedMaterials) return;
    pending.current = null;
    api.account
      .saveLessonChecklist(
        { slug, lessonId, checkedMaterials },
        { context: { keepalive: true } },
      )
      .catch(() => {
        // Следующая отметка отправит весь список заново
        pending.current = checkedMaterials;
      });
  }, [slug, lessonId]);

  // Выход с вкладки или экрана не должен терять последние отметки
  useEffect(() => flush, [flush]);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    pending.current = [...next];
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, CHECKLIST_SAVE_DELAY_MS);
  };

  if (items.length === 0) {
    return <Empty>Список материалов для этого урока не заполнен</Empty>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Нарезано {checked.size} из {items.length}. Отметьте нити до старта
        видео, чтобы руки не отрывались от узлов.
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={isChecked}
                onClick={() => toggle(item.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left ring-1 ${
                  isChecked ? "bg-sage/20 ring-sage" : "bg-surface ring-line"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    isChecked ? "bg-sage text-white" : "ring-2 ring-muted/60"
                  }`}
                >
                  {isChecked && <Check className="size-5" aria-hidden />}
                </span>
                <span className={isChecked ? "text-muted line-through" : ""}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-muted">{children}</p>;
}
