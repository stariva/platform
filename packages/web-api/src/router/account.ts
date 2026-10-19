import { ORPCError } from "@orpc/server";
import { account } from "../procedures";
import {
  canWatchCourse,
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
    // Прогресс сохраняем владельцам курса и админу, который проверяет уроки
    if (!(await canWatchCourse(user.id, input.slug))) {
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

const lessonVideo = account.lessonVideo.handler(
  async ({ input, context, errors }) => {
    const result = await context.services.workshopFiles.signLessonVideo({
      ...input,
      userId: context.session?.user.id ?? null,
      headers: context.headers,
    });
    switch (result.status) {
      case "ok":
        return {
          url: result.url,
          type: result.type,
          expiresIn: result.expiresIn,
        };
      case "lesson_not_found":
        throw errors.LESSON_NOT_FOUND();
      case "video_not_uploaded":
        throw errors.VIDEO_NOT_UPLOADED();
      case "files_unavailable":
        throw errors.FILES_UNAVAILABLE();
      case "not_released":
        throw errors.LESSON_NOT_RELEASED({ message: result.message });
      case "rate_limited":
        throw errors.VIDEO_RATE_LIMITED();
      case "unauthorized":
        throw new ORPCError("UNAUTHORIZED");
      case "forbidden":
        throw new ORPCError("FORBIDDEN");
    }
  },
);

const materialUrl = account.materialUrl.handler(
  async ({ input, context, errors }) => {
    const result = await context.services.workshopFiles.signMaterial({
      ...input,
      userId: context.session?.user.id ?? null,
    });
    switch (result.status) {
      case "ok":
        return { url: result.url };
      case "not_found":
        throw errors.MATERIAL_NOT_FOUND();
      case "files_unavailable":
        throw errors.FILES_UNAVAILABLE();
      case "unauthorized":
        throw new ORPCError("UNAUTHORIZED");
      case "forbidden":
        throw new ORPCError("FORBIDDEN");
    }
  },
);

export const accountRouter = {
  workshopAccess,
  saveLessonProgress,
  lessonVideo,
  materialUrl,
};
