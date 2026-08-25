import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAccess, upsertLessonProgress } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { getWorkshopLesson } from "@/lib/workshops-data";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().min(1),
  lessonId: z.string().min(1),
  positionSeconds: z.number().min(0),
  durationSeconds: z.number().min(0),
  completed: z.boolean().optional(),
});

/** Сохраняет прогресс просмотра урока. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { slug, lessonId, positionSeconds, durationSeconds, completed } =
    parsed.data;

  // Урок должен существовать
  if (!getWorkshopLesson(slug, lessonId)) {
    return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
  }

  // Прогресс сохраняем только владельцам курса
  if (!(await hasAccess(session.user.id, slug))) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  await upsertLessonProgress({
    userId: session.user.id,
    workshopSlug: slug,
    lessonId,
    positionSeconds,
    durationSeconds,
    completed,
  });

  return NextResponse.json({ ok: true });
}
