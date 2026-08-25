import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCourseProgressMap,
  getCourseProgressSummary,
  hasAccess,
} from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopBySlug, getWorkshopLessons } from "@/lib/workshops-data";
import { MaterialsList } from "./materials-list";

export const dynamic = "force-dynamic";

export default async function AccountCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) return null;

  const workshop = getWorkshopBySlug(slug);
  if (!workshop) notFound();

  // Нет доступа — отправляем на публичную страницу с покупкой
  if (!(await hasAccess(session.user.id, slug))) {
    redirect(`/workshops/${slug}`);
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

      {workshop.materialFiles && workshop.materialFiles.length > 0 && (
        <MaterialsList slug={slug} materials={workshop.materialFiles} />
      )}

      <div className="border border-espresso/10 rounded-2xl overflow-hidden bg-white">
        {lessons.map((lesson, i) => {
          const p = progress.get(lesson.id);
          const done = p?.completed;
          return (
            <Link
              key={lesson.id}
              href={`/account/workshops/${slug}/${lesson.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-sand/60 transition-colors ${
                i < lessons.length - 1 ? "border-b border-espresso/8" : ""
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  done ? "bg-sage/25" : "bg-espresso/6"
                }`}
              >
                {done ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8l3 3 5-6"
                      stroke="#5e7050"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-xs text-taupe">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-espresso text-sm">{lesson.title}</span>
                {p && !done && p.positionSeconds > 0 && (
                  <span className="ml-2 text-[11px] text-terracotta">
                    продолжить
                  </span>
                )}
              </div>
              <span className="text-taupe text-xs flex-shrink-0">
                {lesson.duration}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
