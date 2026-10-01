import { z } from "zod";

/** Совпадают с enum'ами таблицы workshops. */
export const WORKSHOP_CATEGORIES = {
  lampshades: "Абажуры",
  clothing: "Одежда",
  interior: "Декор интерьера",
} as const;

export const WORKSHOP_LEVELS = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
} as const;

export const WORKSHOP_STATUS_LABELS = {
  draft: "Черновик",
  published: "На сайте",
  archived: "В архиве",
} as const;

export type WorkshopCategoryId = keyof typeof WORKSHOP_CATEGORIES;
export type WorkshopLevelId = keyof typeof WORKSHOP_LEVELS;

/** Максимум для integer в PostgreSQL, цена хранится в копейках. */
const MAX_RUBLES = 21_474_836;

/** Адрес картинки: из публичного бакета (https) или файл из public/ сайта. */
const imageSrc = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (value.startsWith("/") && !value.startsWith("//")) ||
      z.url({ protocol: /^https$/ }).safeParse(value).success,
    "Нужна ссылка https:// или путь вида /images/…",
  );

const textList = (max: number) =>
  z.array(z.string().trim().min(1).max(max)).max(30);

export const workshopLessonSchema = z.object({
  /** Стабильный id: на него ссылается прогресс просмотра зрителей. */
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, "Укажите название урока").max(200),
  durationSeconds: z
    .number({ error: "Укажите длительность" })
    .int()
    .min(0)
    .max(24 * 3600),
  /** Ключ видео в закрытом бакете; пусто — видео ещё не загружено. */
  videoKey: z.string().trim().max(500),
  free: z.boolean(),
});

export const workshopMaterialFileSchema = z.object({
  label: z.string().trim().min(1, "Укажите название файла").max(200),
  key: z.string().trim().min(1).max(500),
});

export const workshopFormSchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название").max(200),
    // Адрес входит в заказы, доступы и прогресс — после создания не меняется
    slug: z
      .string()
      .trim()
      .min(1, "Укажите адрес")
      .max(120)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Только латиница в нижнем регистре, цифры и дефисы",
      ),
    subtitle: z.string().trim().max(300),
    description: z.string().trim().max(10_000),
    category: z.enum(["lampshades", "clothing", "interior"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    status: z.enum(["draft", "published", "archived"]),
    price: z
      .number({ error: "Укажите цену (0 — бесплатно)" })
      .min(0, "Цена не может быть отрицательной")
      .max(MAX_RUBLES),
    cover: imageSrc,
    previewImage: imageSrc,
    whatYouLearn: textList(300),
    materials: textList(300),
    lessons: z.array(workshopLessonSchema).max(100, "Не больше 100 уроков"),
    materialFiles: z.array(workshopMaterialFileSchema).max(30),
    ozonUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => value === "" || z.url().safeParse(value).success,
        "Нужна ссылка",
      ),
    featured: z.boolean(),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    testimonialText: z.string().trim().max(1000),
    testimonialAuthor: z.string().trim().max(100),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    value.lessons.forEach((lesson, index) => {
      if (ids.has(lesson.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "id"],
          message: "Повторяется id урока",
        });
      }
      ids.add(lesson.id);
    });

    if (value.status === "published") {
      if (!value.cover) {
        ctx.addIssue({
          code: "custom",
          path: ["cover"],
          message: "Для публикации нужна обложка",
        });
      }
      if (value.lessons.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["lessons"],
          message: "Для публикации нужен хотя бы один урок",
        });
      }
      value.lessons.forEach((lesson, index) => {
        if (!lesson.videoKey) {
          ctx.addIssue({
            code: "custom",
            path: ["lessons", index, "videoKey"],
            message: "Загрузите видео — иначе урок не покажется",
          });
        }
      });
    }

    if ((value.testimonialText === "") !== (value.testimonialAuthor === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["testimonialAuthor"],
        message: "Укажите и текст отзыва, и автора — или оставьте оба пустыми",
      });
    }
  });

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;
export type WorkshopLessonValues = z.infer<typeof workshopLessonSchema>;
export type WorkshopMaterialFileValues = z.infer<
  typeof workshopMaterialFileSchema
>;

/** Форматы файлов, которые принимает загрузка материалов. */
export const WORKSHOP_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export const WORKSHOP_MATERIAL_TYPES = ["application/pdf"] as const;

/** 4 ГБ: потолок разовой загрузки в бакет без разбиения на части. */
export const WORKSHOP_VIDEO_MAX_BYTES = 4 * 1024 * 1024 * 1024;
export const WORKSHOP_MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

/** «83» → «1:23», «3725» → «1:02:05». */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** «1:23» → 83, «90» → 90 (секунды), «1:02:05» → 3725. null — не разобрали. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** Человекочитаемая длительность для витрины: 960 → «16 мин», 12000 → «3 ч 20 мин». */
export function formatDurationLabel(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}
