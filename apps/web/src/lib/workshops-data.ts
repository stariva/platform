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
    slug: "dome-lampshade-beginner",
    title: "Абажур «Купол»",
    subtitle: "Классический купольный абажур из хлопкового шнура",
    category: "lampshades",
    level: "beginner",
    price: 1490,
    duration: "3 ч 20 мин",
    lessonsCount: 8,
    cover: "/images/workshops/cover-dome-lampshade.jpg",
    previewImage: "/images/workshops/preview-dome-lampshade.jpg",
    featured: true,
    description:
      "Создайте уютный купольный абажур в технике макраме с нуля. Вы освоите базовые узлы, научитесь работать с металлическим каркасом и создадите плотный красивый узор, который станет центральным элементом любой комнаты.",
    whatYouLearn: [
      "Подготовка каркаса и материала",
      "Базовые узлы: квадратный, спиральный",
      "Техника равномерного натяжения",
      "Крепление нитей к каркасу",
      "Финишная обработка и фрагмент",
    ],
    materials: [
      "Хлопковый шнур 3 мм — 200 м",
      "Металлический каркас d=35 см",
      "Ножницы и расчёска",
      "Патрон E27 с проводом",
    ],
    lessons: [
      { title: "Введение и материалы", duration: "8 мин" },
      { title: "Подготовка каркаса", duration: "12 мин" },
      { title: "Базовые узлы", duration: "28 мин" },
      { title: "Первый ряд", duration: "35 мин" },
      { title: "Средняя часть", duration: "40 мин" },
      { title: "Нижний край и бахрома", duration: "32 мин" },
      { title: "Финишная обработка", duration: "20 мин" },
      { title: "Монтаж и итог", duration: "15 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
  },
  {
    slug: "boho-dress",
    title: "Платье «Бохо»",
    subtitle: "Летнее макраме-платье с открытой спиной",
    category: "clothing",
    level: "intermediate",
    price: 2990,
    duration: "5 ч 10 мин",
    lessonsCount: 11,
    cover: "/images/workshops/cover-boho-dress.jpg",
    previewImage: "/images/workshops/preview-boho-dress.jpg",
    featured: true,
    description:
      "Пошаговый мастер-класс по созданию элегантного летнего платья в технике макраме. Вы научитесь строить выкройку по меркам, работать с хлопковым шнуром в одежде и создавать сложные фактурные узоры.",
    whatYouLearn: [
      "Снятие мерок и расчёт материала",
      "Построение базовой выкройки",
      "Техники плотного и ажурного плетения",
      "Крой и обработка горловины",
      "Сборка и финальная примерка",
    ],
    materials: [
      "Хлопковый шнур 2 мм — 400 м",
      "Деревянная рейка 60 см",
      "Сантиметровая лента",
      "Портновские шпильки",
    ],
    lessons: [
      { title: "Мерки и расчёт", duration: "15 мин" },
      { title: "Подготовка нитей", duration: "20 мин" },
      { title: "Основа лифа", duration: "35 мин" },
      { title: "Узор груди", duration: "45 мин" },
      { title: "Боковые швы", duration: "30 мин" },
      { title: "Юбка часть 1", duration: "40 мин" },
      { title: "Юбка часть 2", duration: "38 мин" },
      { title: "Открытая спина", duration: "30 мин" },
      { title: "Лямки и горловина", duration: "25 мин" },
      { title: "Бахрома подола", duration: "22 мин" },
      { title: "Финишная отделка", duration: "30 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
  },
  {
    slug: "wall-panel-mountain",
    title: "Панно «Горы»",
    subtitle: "Большое настенное панно с пейзажным узором",
    category: "interior",
    level: "beginner",
    price: 990,
    duration: "2 ч 40 мин",
    lessonsCount: 6,
    cover: "/images/workshops/cover-wall-panel.jpg",
    previewImage: "/images/workshops/preview-wall-panel.jpg",
    description:
      "Создайте выразительное настенное панно с силуэтом гор. Идеальный первый проект для знакомства с макраме: простая техника, минимум материалов и максимум результата.",
    whatYouLearn: [
      "Установка нитей на рейку",
      "Узел «жаворонок»",
      "Создание геометрического рисунка",
      "Работа с бахромой и длиной",
      "Оформление и развеска",
    ],
    materials: [
      "Хлопковая верёвка 5 мм — 80 м",
      "Деревянная рейка 60 см",
      "Ножницы и расчёска для бахромы",
    ],
    lessons: [
      { title: "Материалы и инструменты", duration: "7 мин" },
      { title: "Установка нитей", duration: "15 мин" },
      { title: "Базовый узор", duration: "35 мин" },
      { title: "Горный силуэт", duration: "42 мин" },
      { title: "Бахрома", duration: "25 мин" },
      { title: "Оформление работы", duration: "16 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
  },
  {
    slug: "tipi-kids",
    title: "Детский вигвам",
    subtitle: "Уютный игровой шатёр с декором из макраме",
    category: "interior",
    level: "intermediate",
    price: 2490,
    duration: "4 ч 30 мин",
    lessonsCount: 9,
    cover: "/images/workshops/cover-tipi.jpg",
    previewImage: "/images/workshops/preview-tipi.jpg",
    featured: true,
    description:
      "Полное руководство по созданию детского игрового вигвама с декоративными элементами из макраме. Узнаете, как собрать каркас, задрапировать ткань и украсить вход плетёными деталями.",
    whatYouLearn: [
      "Сборка деревянного каркаса",
      "Работа с парусиной и льном",
      "Декоративное плетение входа",
      "Гирлянды и подвески",
      "Финальное оформление",
    ],
    materials: [
      "Деревянные шесты 150 см — 5 шт.",
      "Парусина или лён 3 м",
      "Хлопковый шнур 5 мм — 50 м",
      "Верёвка для крепления",
    ],
    lessons: [
      { title: "Инструменты и материалы", duration: "10 мин" },
      { title: "Сборка каркаса", duration: "25 мин" },
      { title: "Крепление ткани", duration: "35 мин" },
      { title: "Вход и шторка", duration: "30 мин" },
      { title: "Плетение арки", duration: "40 мин" },
      { title: "Боковые украшения", duration: "35 мин" },
      { title: "Гирлянды", duration: "28 мин" },
      { title: "Напольный декор", duration: "22 мин" },
      { title: "Финальный вид", duration: "15 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
  },
  {
    slug: "placemat-set",
    title: "Плейсменты «Кружево»",
    subtitle: "Комплект плетёных подставок на стол из 4 штук",
    category: "interior",
    level: "beginner",
    price: 790,
    duration: "1 ч 50 мин",
    lessonsCount: 5,
    cover: "/images/workshops/cover-placemat.jpg",
    previewImage: "/images/workshops/preview-placemat.jpg",
    description:
      "Быстрый и приятный мастер-класс по плетению набора плейсментов. Отличный подарок и украшение стола. Освоите технику кругового плетения и базовые декоративные узлы.",
    whatYouLearn: [
      "Круговое плетение с центра",
      "Базовые декоративные узлы",
      "Равномерное натяжение",
      "Фиксация края",
    ],
    materials: [
      "Хлопковый шнур 3 мм — 60 м",
      "Картонный шаблон d=30 см",
      "Иголка для вязания",
    ],
    lessons: [
      { title: "Подготовка шаблона", duration: "8 мин" },
      { title: "Центральный узел", duration: "18 мин" },
      { title: "Расширение круга", duration: "30 мин" },
      { title: "Краевой узор", duration: "25 мин" },
      { title: "Финиш и набор", duration: "29 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
  },
  {
    slug: "cylinder-lampshade-advanced",
    title: "Абажур «Цилиндр»",
    subtitle: "Сложный цилиндрический абажур с ажурным узором",
    category: "lampshades",
    level: "advanced",
    price: 3490,
    duration: "6 ч 15 мин",
    lessonsCount: 13,
    cover: "/images/workshops/cover-cylinder-lampshade.jpg",
    previewImage: "/images/workshops/preview-cylinder-lampshade.jpg",
    description:
      "Продвинутый курс для тех, кто уже освоил базовые техники. Создадим цилиндрический абажур с многоуровневым ажурным узором, комбинируя несколько техник плетения.",
    whatYouLearn: [
      "Ажурное плетение на каркасе",
      "Многоуровневые узоры",
      "Работа с цветными акцентами",
      "Соединение секций",
      "Профессиональная финишная обработка",
    ],
    materials: [
      "Хлопковый шнур 3 мм — 300 м",
      "Хлопковый шнур 1.5 мм — 100 м",
      "Цилиндрический каркас d=25 h=40 см",
      "Патрон E27 с проводом",
    ],
    lessons: [
      { title: "Обзор проекта", duration: "12 мин" },
      { title: "Подготовка каркаса", duration: "18 мин" },
      { title: "Верхний ряд", duration: "30 мин" },
      { title: "Ажурная секция 1", duration: "40 мин" },
      { title: "Ажурная секция 2", duration: "38 мин" },
      { title: "Переходный узор", duration: "32 мин" },
      { title: "Центральный узор", duration: "45 мин" },
      { title: "Нижняя ажурная секция", duration: "42 мин" },
      { title: "Цветные акценты", duration: "25 мин" },
      { title: "Нижний край", duration: "28 мин" },
      { title: "Финишная обработка", duration: "22 мин" },
      { title: "Монтаж электрики", duration: "15 мин" },
      { title: "Финальный осмотр", duration: "8 мин" },
    ],
    ozonUrl: "https://www.ozon.ru/",
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
