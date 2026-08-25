import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getCourseProgressSummary,
  listAccessibleSlugs,
} from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import {
  categoryLabels,
  getWorkshopBySlug,
  levelLabels,
} from "@/lib/workshops-data";

export const dynamic = "force-dynamic";

export default async function AccountCoursesPage() {
  const session = await getSession();
  // layout уже гарантирует сессию, но проверяем для типобезопасности
  if (!session) return null;

  const slugs = await listAccessibleSlugs(session.user.id);
  const workshops = slugs
    .map((slug) => getWorkshopBySlug(slug))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  if (workshops.length === 0) {
    return (
      <div className="bg-white border border-espresso/10 rounded-2xl p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-sand flex items-center justify-center mb-4">
          <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7l8 4 8-4-8-4-8 4z"
              stroke="#b85c38"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M5 7v8l8 4 8-4V7"
              stroke="#b85c38"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-espresso mb-2">
          Пока нет купленных курсов
        </h2>
        <p className="text-taupe text-sm mb-6 max-w-sm mx-auto">
          Выберите мастер-класс в каталоге — после оплаты он появится здесь, и
          вы сможете смотреть уроки в любое время.
        </p>
        <Button
          asChild
          className="bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          <Link href="/workshops">Смотреть мастер-классы</Link>
        </Button>
      </div>
    );
  }

  const summaries = await Promise.all(
    workshops.map((w) => getCourseProgressSummary(session.user.id, w)),
  );

  return (
    <div className="space-y-4">
      {workshops.map((workshop, i) => {
        const summary = summaries[i];
        if (!summary) return null;
        const started = summary.completedLessons > 0;
        return (
          <div
            key={workshop.slug}
            className="bg-white border border-espresso/10 rounded-2xl overflow-hidden flex flex-col sm:flex-row"
          >
            <div className="relative sm:w-52 aspect-[16/9] sm:aspect-auto bg-sand flex-shrink-0">
              <Image
                src={workshop.cover}
                alt={workshop.title}
                fill
                sizes="(max-width: 640px) 100vw, 208px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 p-5 flex flex-col">
              <p className="label-caps text-[10px] text-taupe mb-1">
                {categoryLabels[workshop.category]} ·{" "}
                {levelLabels[workshop.level]}
              </p>
              <h2 className="font-serif text-xl text-espresso mb-2">
                {workshop.title}
              </h2>

              <div className="mt-auto">
                <div className="flex items-center justify-between text-xs text-taupe mb-1.5">
                  <span>
                    {summary.completedLessons} из {summary.totalLessons} уроков
                  </span>
                  <span>{summary.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-espresso/10 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full bg-terracotta transition-all"
                    style={{ width: `${summary.percent}%` }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    asChild
                    className="bg-espresso text-parchment hover:bg-espresso/90"
                  >
                    <Link
                      href={
                        summary.resumeLessonId
                          ? `/account/workshops/${workshop.slug}/${summary.resumeLessonId}`
                          : `/account/workshops/${workshop.slug}`
                      }
                    >
                      {summary.isComplete
                        ? "Пересмотреть"
                        : started
                          ? "Продолжить"
                          : "Начать обучение"}
                    </Link>
                  </Button>
                  <Link
                    href={`/account/workshops/${workshop.slug}`}
                    className="text-sm text-taupe hover:text-espresso transition-colors"
                  >
                    Программа курса
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
