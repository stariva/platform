import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourseProgressMap, hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopBySlug, getWorkshopLessons } from "@/lib/workshops-data";
import { VideoPlayer } from "./video-player";

export const dynamic = "force-dynamic";

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await getSession();
  if (!session) return null;

  const workshop = getWorkshopBySlug(slug);
  if (!workshop) notFound();

  if (!(await hasAccess(session.user.id, slug))) {
    redirect(`/workshops/${slug}`);
  }

  const lessons = getWorkshopLessons(workshop);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();

  const lesson = lessons[index];
  if (!lesson) notFound();
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;

  const progress = await getCourseProgressMap(session.user.id, slug);
  const initialPosition = progress.get(lessonId)?.positionSeconds ?? 0;

  return (
    <div>
      <Link
        href={`/account/workshops/${slug}`}
        className="text-sm text-taupe hover:text-espresso transition-colors inline-flex items-center gap-1.5 mb-4"
      >
        ← {workshop.title}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="min-w-0">
          <VideoPlayer
            slug={slug}
            lessonId={lesson.id}
            initialPosition={initialPosition}
          />

          <div className="mt-4">
            <p className="label-caps text-[10px] text-taupe mb-1">
              Урок {index + 1} из {lessons.length}
            </p>
            <h1 className="font-serif text-2xl text-espresso">
              {lesson.title}
            </h1>
          </div>

          <div className="flex items-center justify-between mt-6 gap-3">
            {prev ? (
              <Link
                href={`/account/workshops/${slug}/${prev.id}`}
                className="text-sm text-espresso/70 hover:text-espresso transition-colors"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/account/workshops/${slug}/${next.id}`}
                className="text-sm text-terracotta hover:underline text-right"
              >
                {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>

        {/* Список уроков */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-espresso/10 rounded-2xl overflow-hidden bg-white max-h-[70vh] overflow-y-auto">
            {lessons.map((l, i) => {
              const done = progress.get(l.id)?.completed;
              const active = l.id === lessonId;
              return (
                <Link
                  key={l.id}
                  href={`/account/workshops/${slug}/${l.id}`}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    i < lessons.length - 1 ? "border-b border-espresso/8" : ""
                  } ${active ? "bg-sand" : "hover:bg-sand/60"}`}
                >
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      done
                        ? "bg-sage/25 text-sage-dark"
                        : active
                          ? "bg-terracotta text-parchment"
                          : "bg-espresso/6 text-taupe"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className={`flex-1 min-w-0 truncate ${active ? "text-espresso" : "text-espresso/70"}`}
                  >
                    {l.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
