/**
 * Утилиты для работы с цветами товаров
 */

export interface ColorInfo {
  name: string;
  hex: string;
  textColor?: string; // Цвет текста для контраста (для светлых цветов)
}

/**
 * Маппинг названий цветов на их визуальное представление
 */
export const COLOR_MAP: Record<string, ColorInfo> = {
  // Базовые цвета
  белый: { name: "Белый", hex: "#FFFFFF", textColor: "#2C2416" },
  черный: { name: "Черный", hex: "#000000" },
  серый: { name: "Серый", hex: "#808080" },
  бежевый: { name: "Бежевый", hex: "#E8D5C4", textColor: "#2C2416" },
  коричневый: { name: "Коричневый", hex: "#8B4513" },

  // Теплые цвета
  красный: { name: "Красный", hex: "#DC143C" },
  розовый: { name: "Розовый", hex: "#FFB6C1", textColor: "#2C2416" },
  оранжевый: { name: "Оранжевый", hex: "#FF8C00" },
  желтый: { name: "Желтый", hex: "#FFD700", textColor: "#2C2416" },
  персиковый: { name: "Персиковый", hex: "#FFDAB9", textColor: "#2C2416" },
  терракотовый: { name: "Терракотовый", hex: "#C65D3B" },

  // Холодные цвета
  синий: { name: "Синий", hex: "#4169E1" },
  голубой: { name: "Голубой", hex: "#87CEEB", textColor: "#2C2416" },
  фиолетовый: { name: "Фиолетовый", hex: "#8B008B" },
  сиреневый: { name: "Сиреневый", hex: "#C8A2C8", textColor: "#2C2416" },

  // Природные цвета
  зеленый: { name: "Зеленый", hex: "#228B22" },
  оливковый: { name: "Оливковый", hex: "#808000" },
  мятный: { name: "Мятный", hex: "#98FF98", textColor: "#2C2416" },
  хаки: { name: "Хаки", hex: "#C3B091", textColor: "#2C2416" },

  // Натуральные оттенки (для макраме)
  "натуральный хлопок": {
    name: "Натуральный хлопок",
    hex: "#F5F5DC",
    textColor: "#2C2416",
  },
  экрю: { name: "Экрю", hex: "#F5F5DC", textColor: "#2C2416" },
  слоновая_кость: {
    name: "Слоновая кость",
    hex: "#FFFFF0",
    textColor: "#2C2416",
  },
  кремовый: { name: "Кремовый", hex: "#FFFDD0", textColor: "#2C2416" },
  песочный: { name: "Песочный", hex: "#E8D5C4", textColor: "#2C2416" },

  // Комбинированные цвета
  разноцветный: { name: "Разноцветный", hex: "linear-gradient" }, // Специальная обработка
  многоцветный: { name: "Многоцветный", hex: "linear-gradient" },
};

/**
 * Получить информацию о цвете по его названию
 */
export function getColorInfo(colorName: string | undefined): ColorInfo | null {
  if (!colorName) return null;

  const normalized = colorName.toLowerCase().trim();

  // Прямое совпадение
  if (COLOR_MAP[normalized]) {
    return COLOR_MAP[normalized];
  }

  // Поиск частичного совпадения
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Если цвет не найден, возвращаем дефолтный бежевый
  return {
    name: colorName,
    hex: "#E8D5C4",
    textColor: "#2C2416",
  };
}

/**
 * Парсит строку с несколькими цветами (например, "Белый, Бежевый")
 */
export function parseMultipleColors(
  colorString: string | undefined,
): ColorInfo[] {
  if (!colorString) return [];

  const colors = colorString
    .split(/[,;/]/)
    .map((c) => c.trim())
    .filter(Boolean);

  return colors
    .map((color) => getColorInfo(color))
    .filter((c): c is ColorInfo => c !== null);
}

/**
 * Проверяет, является ли цвет градиентом
 */
export function isGradientColor(colorInfo: ColorInfo): boolean {
  return colorInfo.hex === "linear-gradient";
}
