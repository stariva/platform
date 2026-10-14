import { error, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Кабинет покупателя: процедуры вызывает браузер, доступ — по cookie
 * сессии. Без входа: доступ к курсу — «не вошёл», прогресс — UNAUTHORIZED.
 * Тексты своих ошибок видит посетитель.
 */

/** Такого урока нет в мастер-классе (или мастер-класс снят). */
export const LessonNotFoundError = error("LESSON_NOT_FOUND", {
  message: "Урок не найден",
});

/** У урока ещё нет видео. */
export const VideoNotUploadedError = error("VIDEO_NOT_UPLOADED", {
  message: "Видео ещё не загружено",
});

/** Предзаказ: уроки откроются в дату старта; текст называет дату. */
export const LessonNotReleasedError = error("LESSON_NOT_RELEASED", {
  message: "Урок ещё не открыт",
});

/** За окно времени выдано слишком много ссылок на видео. */
export const VideoRateLimitedError = error("VIDEO_RATE_LIMITED", {
  message: "Слишком много запросов видео. Попробуйте через несколько минут",
});

/** Нет хранилища, откуда брать видео и файлы. */
export const FilesUnavailableError = error("FILES_UNAVAILABLE", {
  message: "Видео и файлы сейчас недоступны. Попробуйте позже",
});

/** Нет такого файла среди материалов курса (или самого курса). */
export const MaterialNotFoundError = error("MATERIAL_NOT_FOUND", {
  message: "Материал не найден",
});

const workshopSlug = z.string().min(1).max(200);

/** Откуда плеер берёт видео: нарезка через сайт или исходный MP4. */
export const lessonVideoSchema = z.object({
  url: z.string(),
  type: z.enum(["hls", "mp4"]),
  /** Через сколько секунд ссылка истечёт. */
  expiresIn: z.number().int().positive(),
});

export type LessonVideo = z.infer<typeof lessonVideoSchema>;

export const accountContract = {
  /** Вошёл ли посетитель и купил ли он мастер-класс. */
  workshopAccess: oc
    .input(z.object({ slug: workshopSlug }))
    .output(z.object({ authenticated: z.boolean(), owned: z.boolean() })),

  /**
   * Сохраняет место, где покупатель остановился в уроке. Только владельцам
   * курса: остальным — FORBIDDEN.
   */
  saveLessonProgress: oc
    .errors({ [LessonNotFoundError.code]: LessonNotFoundError })
    .input(
      z.object({
        slug: workshopSlug,
        lessonId: z.string().min(1).max(200),
        positionSeconds: z.number().min(0),
        durationSeconds: z.number().min(0),
        completed: z.boolean().optional(),
      }),
    )
    .output(type<void>()),

  /**
   * Временная ссылка на видео урока. Превью опубликованного курса открыто
   * всем, остальное — только владельцам (без входа UNAUTHORIZED, без покупки
   * FORBIDDEN).
   */
  lessonVideo: oc
    .errors({
      [LessonNotFoundError.code]: LessonNotFoundError,
      [VideoNotUploadedError.code]: VideoNotUploadedError,
      [LessonNotReleasedError.code]: LessonNotReleasedError,
      [VideoRateLimitedError.code]: VideoRateLimitedError,
      [FilesUnavailableError.code]: FilesUnavailableError,
    })
    .input(
      z.object({ slug: workshopSlug, lessonId: z.string().min(1).max(200) }),
    )
    .output(lessonVideoSchema),

  /**
   * Временная ссылка на PDF-материал курса. Ключ обязан быть из списка
   * материалов этого курса: произвольный объект из бакета не отдаём.
   */
  materialUrl: oc
    .errors({
      [MaterialNotFoundError.code]: MaterialNotFoundError,
      [FilesUnavailableError.code]: FilesUnavailableError,
    })
    .input(z.object({ slug: workshopSlug, key: z.string().min(1).max(1024) }))
    .output(z.object({ url: z.string() })),
};

/** Ответ витрины на запрос ссылки на видео: процедура переводит его в ошибки. */
export type LessonVideoResult =
  | ({ status: "ok" } & LessonVideo)
  | {
      status:
        | "lesson_not_found"
        | "video_not_uploaded"
        | "files_unavailable"
        | "unauthorized"
        | "forbidden"
        | "rate_limited";
    }
  | { status: "not_released"; message: string };

/** Ответ витрины на запрос ссылки на материал курса. */
export type MaterialUrlResult =
  | { status: "ok"; url: string }
  | {
      status: "not_found" | "files_unavailable" | "unauthorized" | "forbidden";
    };
