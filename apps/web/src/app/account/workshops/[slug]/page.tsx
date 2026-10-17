import { hasAccess } from "@stariva/web-api";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCourseProgressMap,
  getCourseProgressSummary,
} from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import {
  getWorkshopLessons,
  hasBriefContent,
  isPreorder,
} from "@/lib/workshops-data";
import { PreorderNotice } from "./preorder-notice";
import { WorkshopBrief } from "./workshop-brief";

export const dynamic = "force-dynamic";

/** Показывает купленный мастер-класс: бриф, предзаказ или уроки с прогрессом. */
export default async function AccountCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) return null;

  const workshop = await getWorkshopBySlug(slug, "owned");
  if (!workshop) notFound();

  const materialFiles = workshop.materialFiles ?? [];
  const brief =
    workshop.materials.length > 0 ||
    materialFiles.length > 0 ||
    hasBriefContent(workshop.brief) ? (
      <WorkshopBrief
        slug={slug}
        title={workshop.title}
        materials={workshop.materials}
        brief={workshop.brief}
        files={materialFiles}
      />
    ) : null;

  // Нет доступа — отправляем на публичную страницу с покупкой
  if (!(await hasAccess(session.user.id, slug))) {
    redirect(`/workshops/${slug}`);
  }

  if (isPreorder(workshop) && workshop.releaseAt) {
    return (
      <div>
        <Link
          href="/account"
          className="text-sm text-taupe hover:text-espresso transition-colors inline-flex items-center gap-1.5 mb-5"
        >
          ← Все мои курсы
        </Link>
        <div className="bg-white border border-espresso/10 rounded-2xl p-6 mb-6">
          <h2 className="font-serif text-2xl text-espresso mb-1">
            {workshop.title}
          </h2>
          <p className="text-taupe text-sm">{workshop.subtitle}</p>
        </div>
        <PreorderNotice workshop={workshop} releaseAt={workshop.releaseAt} />
        {/* Материалы лучше купить заранее — до старта уроков */}
        {brief}
      </div>
    );
  }

  const lessons = getWorkshopLessons(workshop);
  const [progress, summary] = await Promise.all([
    getCourseProgressMap(session.user.id, slug),
    getCourseProgressSummary(session.user.id, workshop),
  ]);

  return (
    <div>
      <Link
        href="/account"
        className="text-sm text-taupe hover:text-espresso transition-colors inline-flex items-center gap-1.5 mb-5"
      >
        ← Все мои курсы
      </Link>

      <div className="bg-white border border-espresso/10 rounded-2xl p-6 mb-6">
        <h2 className="font-serif text-2xl text-espresso mb-1">
          {workshop.title}
        </h2>
        <p className="text-taupe text-sm mb-4">{workshop.subtitle}</p>
        <div className="flex items-center justify-between text-xs text-taupe mb-1.5">
          <span>
            Пройдено {summary.completedLessons} из {summary.totalLessons}
          </span>
          <span>{summary.percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-espresso/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-terracotta transition-all"
            style={{ width: `${summary.percent}%` }}
          />
        </div>
        {summary.isComplete && (
          <Link
            href={`/account/workshops/${slug}/certificate`}
            className="inline-block mt-4 text-sm text-terracotta hover:underline"
          >
            🎓 Получить сертификат о прохождении
          </Link>
        )}
      </div>

      {/* PDF курса — внутри брифа, рядом со списком материалов */}
      {brief}

      <section aria-labelledby="workshop-lessons-title">
        <p className="label-caps text-[11px] text-taupe mb-2">
          {lessons.length === 1 ? "Видеоурок" : "Видеоуроки"}
        </p>
        <h3
          id="workshop-lessons-title"
          className="font-serif text-2xl sm:text-3xl text-espresso leading-tight mb-4"
        >
          {summary.completedLessons === 0 ? "Начните смотреть" : "Уроки"}
        </h3>

        <ol className="space-y-3">
          {lessons.map((lesson, i) => {
            const p = progress.get(lesson.id);
            const done = Boolean(p?.completed);
            const started = !done && (p?.positionSeconds ?? 0) > 0;
            const watchedPercent =
              started && p && p.durationSeconds > 0
                ? Math.min(
                    100,
                    Math.round((p.positionSeconds / p.durationSeconds) * 100),
                  )
                : 0;
            // Главный урок — тот, с которого пользователь продолжит курс
            const isNext =
              !summary.isComplete && lesson.id === summary.resumeLessonId;
            const cta = done
              ? "Пересмотреть"
              : started
                ? "Продолжить"
                : "Смотреть";

            return (
              <li key={lesson.id}>
                <Link
                  href={`/account/workshops/${slug}/${lesson.id}`}
                  className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 ${
                    isNext
                      ? "border-terracotta/40 shadow-sm"
                      : "border-espresso/10 hover:border-espresso/25"
                  }`}
                >
                  <span
                    className={`relative flex-shrink-0 size-12 sm:size-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isNext
                        ? "bg-terracotta text-parchment"
                        : done
                          ? "bg-sage/25 text-[#5e7050]"
                          : "bg-espresso/6 text-espresso"
                    }`}
                  >
                    {done ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 15 15"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 8l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <PlayIcon />
                    )}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] text-taupe mb-0.5">
                      Урок {i + 1}
                      {lesson.duration && ` · ${lesson.duration}`}
                      {done && " · просмотрен"}
                    </span>
                    <span className="block text-espresso text-base leading-snug">
                      {lesson.title}
                    </span>
                    {watchedPercent > 0 && (
                      <span className="mt-2 flex items-center gap-2">
                        <span className="h-1 flex-1 max-w-48 rounded-full bg-espresso/10 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-terracotta"
                            style={{ width: `${watchedPercent}%` }}
                          />
                        </span>
                        <span className="text-[11px] text-taupe">
                          {watchedPercent}%
                        </span>
                      </span>
                    )}
                    {/* На телефоне кнопка не помещается справа — показываем действие под названием */}
                    <span className="sm:hidden mt-1.5 block text-sm text-terracotta">
                      {cta} →
                    </span>
                  </span>

                  <span
                    className={`hidden sm:inline-flex flex-shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors ${
                      isNext
                        ? "bg-terracotta text-parchment group-hover:bg-terracotta-dark"
                        : "border border-espresso/20 text-espresso group-hover:bg-espresso group-hover:text-parchment"
                    }`}
                  >
                    {cta}
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden="true"
      className="ml-0.5"
    >
      <path d="M5 3.4v11.2c0 .6.7 1 1.2.7l9-5.6a.8.8 0 0 0 0-1.4l-9-5.6C5.7 2.4 5 2.8 5 3.4Z" />
    </svg>
  );
}
