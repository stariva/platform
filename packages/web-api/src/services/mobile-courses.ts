import { randomUUID } from "node:crypto";
import { and, asc, db, desc, eq, inArray, ne } from "@stariva/db";
import {
  appReleases,
  courseAccess,
  lessonProgress,
  type WorkshopRow,
  workshops,
} from "@stariva/db/schema";
import type {
  AppRelease,
  CatalogCourse,
  LessonDetails,
  LessonSummary,
  MobileCourse,
  MobileCourses,
} from "../contract";
import { canWatchCourse } from "./course-access";

type Lesson = WorkshopRow["lessons"][number];

/** Та же витрина, что на сайте: только опубликованные и доступные к покупке курсы. */
export async function listCatalogCourses(): Promise<CatalogCourse[]> {
  const rows = await db
    .select()
    .from(workshops)
    .where(eq(workshops.status, "published"))
    .orderBy(asc(workshops.sortOrder), asc(workshops.createdAt));
  const now = Date.now();
  const releaseBySlug = new Map(rows.map((row) => [row.slug, row.releaseAt]));
  const mainReleaseAt = releaseBySlug.get("elka-makrame");
  return (
    rows
      // Пока большая ёлка идёт подарком к предзаказу основной, сайт её не продаёт.
      .filter(
        (row) =>
          row.slug !== "elka-makrame-bolshaya" ||
          !mainReleaseAt ||
          mainReleaseAt.getTime() <= now,
      )
      .map((row) => ({
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        description: row.description,
        cover: row.cover,
        category: row.category,
        level: row.level,
        priceKopecks:
          !row.releaseAt || row.releaseAt.getTime() <= now
            ? (row.priceAfterRelease ?? row.price)
            : row.price,
        lessonCount: row.lessons.length,
        isPreorder: Boolean(row.releaseAt && row.releaseAt.getTime() > now),
      }))
  );
}

/** Видят купившие: опубликованный курс или архивный, но не черновик. */
async function findVisibleWorkshop(slug: string) {
  const [row] = await db
    .select()
    .from(workshops)
    .where(and(eq(workshops.slug, slug), ne(workshops.status, "draft")))
    .limit(1);
  return row ?? null;
}

/**
 * Купленные мастер-классы с прогрессом, карточка «Продолжить плетение» и
 * демо-урок для тех, у кого курсов ещё нет (магазины требуют бесплатный
 * контент без покупки).
 */
export async function listMobileCourses(
  userId: string,
): Promise<MobileCourses> {
  const access = await db
    .select({
      slug: courseAccess.workshopSlug,
      grantedAt: courseAccess.grantedAt,
    })
    .from(courseAccess)
    .where(eq(courseAccess.userId, userId))
    .orderBy(desc(courseAccess.grantedAt));
  const slugs = access.map((a) => a.slug);

  const [owned, progress] = await Promise.all([
    slugs.length
      ? db
          .select()
          .from(workshops)
          .where(
            and(inArray(workshops.slug, slugs), ne(workshops.status, "draft")),
          )
      : Promise.resolve([]),
    slugs.length
      ? db
          .select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, userId),
              inArray(lessonProgress.workshopSlug, slugs),
            ),
          )
          .orderBy(desc(lessonProgress.updatedAt))
      : Promise.resolve([]),
  ]);

  const bySlug = new Map(owned.map((w) => [w.slug, w]));
  const courses: MobileCourse[] = [];
  for (const { slug } of access) {
    const workshop = bySlug.get(slug);
    if (!workshop) continue;
    const lessonIds = new Set(workshop.lessons.map((l) => l.id));
    const completedLessons = progress.filter(
      (p) =>
        p.workshopSlug === slug && p.completed && lessonIds.has(p.lessonId),
    ).length;
    courses.push({
      slug,
      title: workshop.title,
      cover: workshop.cover,
      firstLessonId: workshop.lessons[0]?.id ?? null,
      lessonCount: workshop.lessons.length,
      completedLessons,
    });
  }

  // Самая свежая запись о незавершённом уроке, который ещё есть в курсе
  let resume: MobileCourses["resume"] = null;
  for (const p of progress) {
    const workshop = bySlug.get(p.workshopSlug);
    const lesson = workshop?.lessons.find((l) => l.id === p.lessonId);
    if (!workshop || !lesson || p.completed || p.positionSeconds <= 0) continue;
    resume = {
      slug: workshop.slug,
      workshopTitle: workshop.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      positionSeconds: p.positionSeconds,
    };
    break;
  }

  return { courses, resume, demo: await findDemoLesson() };
}

/** Первый бесплатный урок опубликованного курса. */
async function findDemoLesson(): Promise<MobileCourses["demo"]> {
  const published = await db
    .select()
    .from(workshops)
    .where(eq(workshops.status, "published"))
    .orderBy(workshops.sortOrder);
  for (const workshop of published) {
    const lesson = workshop.lessons.find((l) => l.free && l.videoKey);
    if (lesson) {
      return {
        slug: workshop.slug,
        workshopTitle: workshop.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      };
    }
  }
  return null;
}

/** Главы по порядку и без мусора: плеер ищет активную главу бинарно. */
function cleanChapters(lesson: Lesson, durationSeconds: number) {
  return (lesson.chapters ?? [])
    .filter(
      (c) => c.time >= 0 && (durationSeconds <= 0 || c.time < durationSeconds),
    )
    .sort((a, b) => a.time - b.time);
}

export type LessonDetailsResult =
  | { status: "ok"; details: LessonDetails }
  | { status: "not_found" | "unauthorized" | "forbidden" };

/**
 * Всё, что приложение показывает под плеером. Бесплатное превью открыто всем,
 * остальное — владельцам курса и админу.
 */
export async function getLessonDetails(input: {
  userId: string | null;
  slug: string;
  lessonId: string;
}): Promise<LessonDetailsResult> {
  const workshop = await findVisibleWorkshop(input.slug);
  const lesson = workshop?.lessons.find((l) => l.id === input.lessonId);
  if (!workshop || !lesson) return { status: "not_found" };

  const isPreview = lesson.free && workshop.status === "published";
  if (!isPreview) {
    if (!input.userId) return { status: "unauthorized" };
    if (!(await canWatchCourse(input.userId, workshop.slug))) {
      return { status: "forbidden" };
    }
  }

  const progress = input.userId
    ? await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, input.userId),
            eq(lessonProgress.workshopSlug, workshop.slug),
          ),
        )
    : [];
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const own = byLesson.get(lesson.id);

  const lessons: LessonSummary[] = workshop.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    durationSeconds: l.durationSeconds,
    free: l.free,
    completed: byLesson.get(l.id)?.completed ?? false,
    positionSeconds: byLesson.get(l.id)?.positionSeconds ?? 0,
  }));

  return {
    status: "ok",
    details: {
      slug: workshop.slug,
      workshopTitle: workshop.title,
      lessonId: lesson.id,
      title: lesson.title,
      durationSeconds: lesson.durationSeconds,
      positionSeconds: own?.positionSeconds ?? 0,
      completed: own?.completed ?? false,
      chapters: cleanChapters(lesson, lesson.durationSeconds),
      checklist: lesson.materialsChecklist ?? [],
      // Без привязки к урокам удалённых пунктов: отметки не должны «висеть»
      checkedMaterials: (own?.checkedMaterials ?? []).filter((id) =>
        lesson.materialsChecklist?.some((item) => item.id === id),
      ),
      attachments: lesson.attachments ?? [],
      lessons,
    },
  };
}

/**
 * Сохраняет отмеченные в чек-листе материалы. В базу попадают только id,
 * которые есть в чек-листе урока, без повторов. Строки прогресса может ещё не
 * быть — тогда создаём её с нулевой позицией, чтобы потом её не затёрли.
 */
export async function saveLessonChecklist(input: {
  userId: string;
  slug: string;
  lessonId: string;
  checkedMaterials: string[];
}): Promise<"ok" | "not_found" | "forbidden"> {
  const workshop = await findVisibleWorkshop(input.slug);
  const lesson = workshop?.lessons.find((l) => l.id === input.lessonId);
  if (!workshop || !lesson) return "not_found";
  if (!(await canWatchCourse(input.userId, workshop.slug))) return "forbidden";

  const known = new Set((lesson.materialsChecklist ?? []).map((i) => i.id));
  const checked = [...new Set(input.checkedMaterials)].filter((id) =>
    known.has(id),
  );

  await db
    .insert(lessonProgress)
    .values({
      id: randomUUID(),
      userId: input.userId,
      workshopSlug: workshop.slug,
      lessonId: lesson.id,
      durationSeconds: lesson.durationSeconds,
      checkedMaterials: checked,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { checkedMaterials: checked, updatedAt: new Date() },
    });
  return "ok";
}

/** Последний релиз по номеру сборки; null — релизов ещё не было. */
export async function getLatestRelease(): Promise<AppRelease | null> {
  const [row] = await db
    .select()
    .from(appReleases)
    .orderBy(desc(appReleases.buildNumber))
    .limit(1);
  if (!row) return null;
  return {
    version: row.version,
    bundleZipUrl: row.bundleZipUrl,
    bundleChecksum: row.bundleChecksum,
    minNativeVersion: row.minNativeVersion,
    apkDownloadUrl: row.apkDownloadUrl,
    releaseNotes: row.releaseNotes,
  };
}
