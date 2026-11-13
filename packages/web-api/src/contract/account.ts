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

/** Хранилище фото не настроено или не ответило — отзыв не сохранён. */
export const ReviewUnavailableError = error("REVIEW_UNAVAILABLE", {
  message: "Не получилось сохранить отзыв. Попробуйте позже",
});

/** Файл назван картинкой, но по содержимому это не JPG, PNG или WebP. */
export const ReviewPhotoInvalidError = error("REVIEW_PHOTO_INVALID", {
  message: "Одно из фото не открылось. Выберите снимок в формате JPG или PNG",
});

const workshopSlug = z.string().min(1).max(200);

export const MAX_REVIEW_PHOTOS = 3;
/** Браузер сжимает снимок до ~1 МБ, запас — на случай, если сжать не вышло. */
export const MAX_REVIEW_PHOTO_BYTES = 2.5 * 1024 * 1024;

/** Отзыв покупателя о мастер-классе, как его видит автор в кабинете. */
export const workshopReviewSchema = z.object({
  rating: z.number().int(),
  text: z.string(),
  reviewerName: z.string(),
  photos: z.array(z.string()),
  /** pending — ждёт проверки, published — виден на сайте. */
  status: z.enum(["pending", "published"]),
});

export type WorkshopReview = z.infer<typeof workshopReviewSchema>;

/** Откуда плеер берёт видео: нарезка через сайт или исходный MP4. */
export const lessonVideoSchema = z.object({
  url: z.string(),
  type: z.enum(["hls", "mp4"]),
  /** Через сколько секунд ссылка истечёт. */
  expiresIn: z.number().int().positive(),
});

export type LessonVideo = z.infer<typeof lessonVideoSchema>;

/** Строка списка уроков курса под плеером. */
export const lessonSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSeconds: z.number().int(),
  free: z.boolean(),
  completed: z.boolean(),
  positionSeconds: z.number().int(),
});

export type LessonSummary = z.infer<typeof lessonSummarySchema>;

/** Всё, что приложение показывает под плеером урока. */
export const lessonDetailsSchema = z.object({
  slug: z.string(),
  workshopTitle: z.string(),
  lessonId: z.string(),
  title: z.string(),
  durationSeconds: z.number().int(),
  /** Где остановился зритель — с этой секунды плеер продолжает. */
  positionSeconds: z.number().int(),
  completed: z.boolean(),
  /** Этапы урока: тап по главе перематывает плеер. */
  chapters: z.array(
    z.object({ time: z.number().int().min(0), title: z.string() }),
  ),
  checklist: z.array(z.object({ id: z.string(), label: z.string() })),
  /** Отмеченные пункты чек-листа (их id). */
  checkedMaterials: z.array(z.string()),
  attachments: z.array(
    z.object({
      label: z.string(),
      key: z.string(),
      kind: z.enum(["pdf", "image"]),
    }),
  ),
  lessons: z.array(lessonSummarySchema),
});

export type LessonDetails = z.infer<typeof lessonDetailsSchema>;

export const mobileCourseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  cover: z.string(),
  lessonCount: z.number().int(),
  completedLessons: z.number().int(),
});

export type MobileCourse = z.infer<typeof mobileCourseSchema>;

/** Главный экран приложения: курсы, «Продолжить плетение» и демо-урок. */
export const mobileCoursesSchema = z.object({
  courses: z.array(mobileCourseSchema),
  resume: z
    .object({
      slug: z.string(),
      workshopTitle: z.string(),
      lessonId: z.string(),
      lessonTitle: z.string(),
      positionSeconds: z.number().int(),
    })
    .nullable(),
  /** Бесплатный урок для всех: магазины требуют контент без покупки. */
  demo: z
    .object({
      slug: z.string(),
      workshopTitle: z.string(),
      lessonId: z.string(),
      lessonTitle: z.string(),
    })
    .nullable(),
});

export type MobileCourses = z.infer<typeof mobileCoursesSchema>;

export const appReleaseSchema = z.object({
  version: z.string(),
  bundleZipUrl: z.string(),
  minNativeVersion: z.string(),
  apkDownloadUrl: z.string().nullable(),
  releaseNotes: z.string(),
});

export type AppRelease = z.infer<typeof appReleaseSchema>;

export const accountContract = {
  /** Вошёл ли посетитель и купил ли он мастер-класс. */
  workshopAccess: oc
    .input(z.object({ slug: workshopSlug }))
    .output(z.object({ authenticated: z.boolean(), owned: z.boolean() })),

  /**
   * Купленные мастер-классы с прогрессом для главного экрана приложения.
   * Без входа — UNAUTHORIZED.
   */
  myCourses: oc.output(mobileCoursesSchema),

  /**
   * Главы, чек-лист нарезки, схемы и список уроков для экрана урока.
   * Бесплатное превью открыто всем, остальное — владельцам (без входа
   * UNAUTHORIZED, без покупки FORBIDDEN).
   */
  lessonDetails: oc
    .errors({ [LessonNotFoundError.code]: LessonNotFoundError })
    .input(
      z.object({ slug: workshopSlug, lessonId: z.string().min(1).max(200) }),
    )
    .output(lessonDetailsSchema),

  /**
   * Сохраняет отмеченные в чек-листе нарезки материалы урока. Лишние id
   * отбрасываются. Только владельцам курса.
   */
  saveLessonChecklist: oc
    .errors({ [LessonNotFoundError.code]: LessonNotFoundError })
    .input(
      z.object({
        slug: workshopSlug,
        lessonId: z.string().min(1).max(200),
        checkedMaterials: z.array(z.string().min(1).max(200)).max(200),
      }),
    )
    .output(type<void>()),

  /** Последний релиз приложения для кнопки «Проверить обновления». */
  latestRelease: oc.output(appReleaseSchema.nullable()),

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
   * Ссылка на PDF-материал курса — адрес на сайте, а не в бакете. Ключ обязан
   * быть из списка материалов этого курса: произвольный объект не отдаём.
   */
  materialUrl: oc
    .errors({
      [MaterialNotFoundError.code]: MaterialNotFoundError,
      [FilesUnavailableError.code]: FilesUnavailableError,
    })
    .input(z.object({ slug: workshopSlug, key: z.string().min(1).max(1024) }))
    .output(z.object({ url: z.string() })),

  /**
   * Отзыв купившего о мастер-классе: один на курс, повторная отправка его
   * заменяет. На сайт попадает только после проверки, правка опубликованного
   * отправляет его на проверку снова. Не купившим — FORBIDDEN.
   */
  saveWorkshopReview: oc
    .errors({
      [ReviewUnavailableError.code]: ReviewUnavailableError,
      [ReviewPhotoInvalidError.code]: ReviewPhotoInvalidError,
    })
    .input(
      z
        .object({
          slug: workshopSlug,
          rating: z
            .number()
            .int()
            .min(1, "Поставьте оценку")
            .max(5, "Поставьте оценку"),
          text: z
            .string()
            .trim()
            .min(10, "Напишите хотя бы пару предложений")
            .max(
              3000,
              "Отзыв получился длинным — сократите его до 3000 знаков",
            ),
          reviewerName: z
            .string()
            .trim()
            .min(1, "Укажите, как подписать отзыв")
            .max(80),
          /** Уже загруженные фото отзыва, которые автор оставил. */
          keepPhotos: z.array(z.string().max(1024)).max(MAX_REVIEW_PHOTOS),
          photos: z
            .array(
              z
                .file()
                .max(
                  MAX_REVIEW_PHOTO_BYTES,
                  "Фото слишком большое. Выберите другой снимок",
                )
                .mime(
                  ["image/jpeg", "image/png", "image/webp"],
                  "Выберите снимок в формате JPG или PNG",
                ),
            )
            .max(MAX_REVIEW_PHOTOS),
          publishConsent: z.literal(true, {
            error: "Нужно согласие на публикацию отзыва",
          }),
        })
        .refine(
          (input) =>
            input.keepPhotos.length + input.photos.length <= MAX_REVIEW_PHOTOS,
          {
            message: `Можно приложить не больше ${MAX_REVIEW_PHOTOS} фото`,
            path: ["photos"],
          },
        ),
    )
    .output(workshopReviewSchema),
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
