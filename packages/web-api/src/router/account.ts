import { ORPCError } from "@orpc/server";
import { account } from "../procedures";
import {
  hasAccess,
  lessonExists,
  upsertLessonProgress,
} from "../services/course-access";

const workshopAccess = account.workshopAccess.handler(
  async ({ input, context }) => {
    if (!context.session) return { authenticated: false, owned: false };
    return {
      authenticated: true,
      owned: await hasAccess(context.session.user.id, input.slug),
    };
  },
);

const saveLessonProgress = account.saveLessonProgress.handler(
  async ({ input, context, errors }) => {
    const user = context.session?.user;
    if (!user) throw new ORPCError("UNAUTHORIZED");
    if (!(await lessonExists(input.slug, input.lessonId))) {
      throw errors.LESSON_NOT_FOUND();
    }
    // Прогресс сохраняем только владельцам курса
    if (!(await hasAccess(user.id, input.slug))) {
      throw new ORPCError("FORBIDDEN");
    }
    await upsertLessonProgress({
      userId: user.id,
      workshopSlug: input.slug,
      lessonId: input.lessonId,
      positionSeconds: input.positionSeconds,
      durationSeconds: input.durationSeconds,
      completed: input.completed,
    });
  },
);

export const accountRouter = { workshopAccess, saveLessonProgress };
