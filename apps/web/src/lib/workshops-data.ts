// Сами мастер-классы лежат в таблице workshops и правятся в админке;
// читает их ./workshops/workshops-db.ts. Здесь — типы, подписи и чистые хелперы.

export type WorkshopLevel = "beginner" | "intermediate" | "advanced";
export type WorkshopCategory = "lampshades" | "clothing" | "interior";
export type WorkshopStatus = "draft" | "published" | "archived";

export interface WorkshopLesson {
  /** Стабильный идентификатор урока: на него ссылается прогресс просмотра. */
  id: string;
  title: string;
  durationSeconds: number;
  /** Ключ объекта видео в Yandex S3. Пусто — видео ещё не загружено. */
  videoKey: string;
  /** Бесплатный урок-превью (доступен без покупки). */
  free: boolean;
}

/** Урок в виде, удобном для страниц и плеера. */
export interface ResolvedLesson {
  id: string;
  index: number;
  title: string;
  duration: string;
  durationSeconds: number;
  videoKey: string;
  free: boolean;
}

/** PDF-материал к мастер-классу (хранится в Yandex S3). */
export interface WorkshopMaterialFile {
  label: string;
  key: string;
}

export interface Workshop {
  slug: string;
  /** archived — не продаётся и не в каталоге, но купившие продолжают смотреть. */
  status: WorkshopStatus;
  title: string;
  subtitle: string;
  category: WorkshopCategory;
  level: WorkshopLevel;
  /** В рублях; 0 — бесплатный курс. */
  price: number;
  /** Общая длительность, например «3 ч 20 мин». */
  duration: string;
  lessonsCount: number;
  cover: string;
  previewImage: string;
  description: string;
  whatYouLearn: string[];
  materials: string[];
  lessons: WorkshopLesson[];
  /** PDF-материалы курса для скачивания (хранятся в Yandex S3). */
  materialFiles?: WorkshopMaterialFile[];
  ozonUrl?: string;
  featured?: boolean;
  /** Один отзыв для страницы курса (вместо общей ленты отзывов с Ozon). */
  testimonial?: { text: string; author: string };
}

export const categoryLabels: Record<WorkshopCategory, string> = {
  lampshades: "Абажуры",
  clothing: "Одежда",
  interior: "Декор интерьера",
};

export const levelLabels: Record<WorkshopLevel, string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export const levelColors: Record<WorkshopLevel, string> = {
  beginner: "bg-sage/20 text-sage",
  intermediate: "bg-linen/40 text-espresso",
  advanced: "bg-terracotta/15 text-terracotta",
};

export function formatPrice(price: number): string {
  if (price === 0) return "Бесплатно";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

/** Длительность для витрины: 960 → «16 мин», 12000 → «3 ч 20 мин». */
export function formatDurationLabel(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** Адрес картинки с доменом: в соцсети и sitemap нужны абсолютные ссылки. */
export function absoluteImageUrl(baseUrl: string, src: string): string {
  return src.startsWith("http") ? src : `${baseUrl}${src}`;
}

/** Уроки мастер-класса в удобном для страниц виде. */
export function getWorkshopLessons(workshop: Workshop): ResolvedLesson[] {
  return workshop.lessons.map((lesson, i) => ({
    id: lesson.id,
    index: i,
    title: lesson.title,
    duration: formatDurationLabel(lesson.durationSeconds),
    durationSeconds: lesson.durationSeconds,
    videoKey: lesson.videoKey,
    free: lesson.free,
  }));
}

/** Находит урок мастер-класса по его id. */
export function findWorkshopLesson(
  workshop: Workshop,
  lessonId: string,
): ResolvedLesson | undefined {
  return getWorkshopLessons(workshop).find((l) => l.id === lessonId);
}

/** Цена мастер-класса в копейках (для платёжной системы и БД). */
export function workshopPriceKopecks(workshop: Workshop): number {
  return Math.round(workshop.price * 100);
}
