export type WorkshopLevel = "beginner" | "intermediate" | "advanced";
export type WorkshopCategory = "lampshades" | "clothing" | "interior";

export interface WorkshopLesson {
  title: string;
  duration: string; // e.g. "12 мин"
  /** Стабильный идентификатор урока. Если не задан — генерируется как `${slug}-${n}`. */
  id?: string;
  /** Ключ объекта видео в Yandex S3. Если не задан — `workshops/${slug}/${id}.mp4`. */
  videoKey?: string;
  /** Бесплатный урок-превью (доступен без покупки). По умолчанию бесплатен только первый. */
  free?: boolean;
}

/** Урок с гарантированно заполненными полями (после резолвинга). */
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
  title: string;
  subtitle: string;
  category: WorkshopCategory;
  level: WorkshopLevel;
  price: number;
  duration: string; // total, e.g. "3 ч 20 мин"
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

export const workshops: Workshop[] = [
  {
    slug: "poyas-makrame-serdce",
    title: "Пояс макраме «Сердце»",
    subtitle: "Бесплатный мастер-класс: плетёный пояс с узором-сердцем",
    category: "clothing",
    level: "beginner",
    price: 0,
    duration: "16 мин",
    lessonsCount: 1,
    cover: "/images/workshops/cover-poyas-serdce.jpg",
    previewImage: "/images/workshops/preview-poyas-serdce.jpg",
    featured: true,
    description:
      "Бесплатный мастер-класс для знакомства с макраме: сплетите изящный пояс с узором-сердцем в одном видеоуроке. Идеальный первый проект, чтобы попробовать технику перед покупкой полного курса.",
    whatYouLearn: [
      "Базовые узлы макраме для пояса",
      "Плетение узора-сердца",
      "Равномерное натяжение нити",
      "Финишная обработка концов и завязки",
    ],
    materials: [
      "Хлопковый шнур 3 мм — 15 м",
      "Кольцо или пряжка для пояса",
      "Ножницы",
      "Расчёска для бахромы",
    ],
    lessons: [
      {
        title: "Плетение пояса «Сердце»",
        duration: "16 мин",
        free: true,
      },
    ],
    testimonial: {
      text: "ПЛЕЙСХОЛДЕР — заменить на реальный отзыв клиентки после публикации мастер-класса.",
      author: "Имя, город",
    },
  },
];

export function getWorkshopBySlug(slug: string): Workshop | undefined {
  return workshops.find((w) => w.slug === slug);
}

export function getWorkshopsByCategory(category: WorkshopCategory): Workshop[] {
  return workshops.filter((w) => w.category === category);
}

export function getFeaturedWorkshops(): Workshop[] {
  return workshops.filter((w) => w.featured);
}

export function formatPrice(price: number): string {
  if (price === 0) return "Бесплатно";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Парсит человекочитаемую длительность ("3 ч 20 мин", "12 мин") в секунды.
 */
export function parseDurationToSeconds(duration: string): number {
  let total = 0;
  const hours = duration.match(/(\d+)\s*ч/);
  const minutes = duration.match(/(\d+)\s*мин/);
  if (hours) total += Number(hours[1]) * 3600;
  if (minutes) total += Number(minutes[1]) * 60;
  return total;
}

/** Префикс ключей объектов курса в Yandex S3. */
export function workshopStoragePrefix(slug: string): string {
  return `workshops/${slug}`;
}

/**
 * Возвращает уроки мастер-класса с заполненными id, ключами видео и флагом
 * бесплатного превью. По умолчанию бесплатен только первый урок.
 *
 * Конвенция ключей S3 (если videoKey не задан явно):
 *   workshops/<slug>/<lessonId>.mp4
 */
export function getWorkshopLessons(workshop: Workshop): ResolvedLesson[] {
  return workshop.lessons.map((lesson, i) => {
    const id = lesson.id ?? `${workshop.slug}-${i + 1}`;
    return {
      id,
      index: i,
      title: lesson.title,
      duration: lesson.duration,
      durationSeconds: parseDurationToSeconds(lesson.duration),
      videoKey:
        lesson.videoKey ?? `${workshopStoragePrefix(workshop.slug)}/${id}.mp4`,
      free: lesson.free ?? i === 0,
    };
  });
}

/** Находит конкретный урок мастер-класса по его id. */
export function getWorkshopLesson(
  slug: string,
  lessonId: string,
): { workshop: Workshop; lesson: ResolvedLesson } | undefined {
  const workshop = getWorkshopBySlug(slug);
  if (!workshop) return undefined;
  const lesson = getWorkshopLessons(workshop).find((l) => l.id === lessonId);
  if (!lesson) return undefined;
  return { workshop, lesson };
}

/** Цена мастер-класса в копейках (для платёжной системы и БД). */
export function workshopPriceKopecks(workshop: Workshop): number {
  return Math.round(workshop.price * 100);
}
