import type { MobileCourse } from "@stariva/web-api/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CircleCheck, Play, Star } from "lucide-react";
import { useState } from "react";
import { Badge, Button, ProgressBar } from "@/components/ui/Primitives";
import { API_URL, api } from "@/lib/api";
import { native } from "@/lib/native";

export function CourseDetailScreen({
  course,
  resumeLessonId,
  onBack,
  onLesson,
}: {
  course: MobileCourse;
  resumeLessonId: string | null;
  onBack: () => void;
  onLesson: (id: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const queryClient = useQueryClient();
  const firstLessonId = resumeLessonId ?? course.firstLessonId;
  const lessons = useQuery({
    queryKey: ["lesson", course.slug, firstLessonId],
    queryFn: () => {
      if (!firstLessonId) throw new Error("У курса пока нет уроков");
      return api.account.lessonDetails({ slug: course.slug, lessonId: firstLessonId });
    },
    enabled: Boolean(firstLessonId),
  });
  const review = useMutation({
    mutationFn: () =>
      api.account.saveWorkshopReview({
        slug: course.slug,
        rating,
        text,
        reviewerName: "Участник Stariva",
        keepPhotos: [],
        photos: [],
        publishConsent: true,
      }),
    onSuccess: () => {
      setFeedback("Спасибо! Отзыв отправлен на проверку.");
      void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
    },
    onError: () =>
      setFeedback("Не удалось отправить отзыв. Попробуйте ещё раз."),
  });
  const cover = /^https?:\/\//.test(course.cover)
    ? course.cover
    : `${API_URL}${course.cover.startsWith("/") ? "" : "/"}${course.cover}`;
  return (
    <main className="min-h-dvh bg-bg pb-24 text-fg">
      <div className="relative">
        <img src={cover} alt="" className="aspect-[4/3] w-full object-cover" />
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="glass absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] flex size-12 items-center justify-center rounded-full"
        >
          <ArrowLeft />
        </button>
      </div>
      <div className="relative -mt-6 rounded-t-[var(--radius-xl)] bg-bg px-5 pt-7">
        <Badge>Ваш онлайн-курс</Badge>
        <h1 className="display mt-4">{course.title}</h1>
        <p className="mt-4 text-sm text-muted">
          {course.completedLessons} из {course.lessonCount} уроков пройдено
        </p>
        <div className="mt-3">
          <ProgressBar
            value={
              course.lessonCount
                ? (course.completedLessons / course.lessonCount) * 100
                : 0
            }
          />
        </div>
        {firstLessonId ? (
          <Button
            className="mt-7 w-full"
            onClick={() => onLesson(firstLessonId)}
          >
            <Play size={19} />
            {resumeLessonId ? "Продолжить просмотр" : "Начать просмотр"}
          </Button>
        ) : (
          <div className="mt-7 rounded-[var(--radius-lg)] bg-surface p-5 text-sm text-muted">
            Уроки этого курса пока готовятся.
          </div>
        )}
        {lessons.data && (
          <section className="mt-9">
            <h2 className="section-title">Уроки курса</h2>
            <div className="mt-4 space-y-2">
              {lessons.data.lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onLesson(lesson.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-md)] bg-surface px-4 text-left ring-1 ring-line"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-sm font-semibold">
                    {lesson.completed ? <CircleCheck size={19} className="text-sage" /> : index + 1}
                  </span>
                  <span className="flex-1 font-medium">{lesson.title}</span>
                  <Play size={17} className="text-accent" />
                </button>
              ))}
            </div>
          </section>
        )}
        <a
          href={`${API_URL || "https://stariva.ru"}/workshops/${course.slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.preventDefault();
            void native.openExternal(event.currentTarget.href);
          }}
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-surface px-5 text-sm font-semibold ring-1 ring-line"
        >
          Открыть курс на сайте <ArrowRight size={18} />
        </a>
        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={() =>
            void native
              .share(
                course.title,
                `${API_URL || "https://stariva.ru"}/workshops/${course.slug}`,
              )
              .then(() => setFeedback("Ссылка готова к отправке"))
              .catch(() => {})
          }
        >
          Поделиться курсом
        </Button>
        {course.lessonCount > 0 &&
          course.completedLessons >= course.lessonCount && (
            <section className="mt-10">
              <h2 className="section-title">Поделитесь впечатлением</h2>
              <p className="mt-2 text-sm text-muted">
                Ваш отзыв поможет другим начать.
              </p>
              <fieldset aria-label="Оценка" className="mt-4 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} из 5`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                    className="flex size-12 items-center justify-center"
                  >
                    <Star
                      size={25}
                      fill={value <= rating ? "currentColor" : "none"}
                      className="text-accent"
                    />
                  </button>
                ))}
              </fieldset>
              <label
                className="mt-4 block text-sm font-medium"
                htmlFor="review-text"
              >
                Ваш отзыв
              </label>
              <textarea
                id="review-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                maxLength={3000}
                className="mt-2 w-full rounded-[var(--radius-md)] bg-surface p-4 text-sm ring-1 ring-line"
                placeholder="Что понравилось? Что удалось создать?"
              />
              <p className="mt-2 text-xs text-muted">
                Отправляя отзыв, вы соглашаетесь с его публикацией после
                проверки.
              </p>
              <Button
                className="mt-4 w-full"
                disabled={
                  rating === 0 || text.trim().length < 10 || review.isPending
                }
                onClick={() => review.mutate()}
              >
                {review.isPending ? "Отправляем…" : "Отправить отзыв"}
              </Button>
              {feedback && (
                <p role="status" className="mt-3 text-sm">
                  {feedback}
                </p>
              )}
            </section>
          )}
      </div>
    </main>
  );
}
