import { ColorIndicator } from "@/components/stariva/color-indicator";
import { COLOR_MAP } from "@/lib/colors";

export default function ColorsDemo() {
  const colorGroups = {
    "Базовые цвета": ["белый", "черный", "серый", "бежевый", "коричневый"],
    "Теплые цвета": [
      "красный",
      "розовый",
      "оранжевый",
      "желтый",
      "персиковый",
      "терракотовый",
    ],
    "Холодные цвета": ["синий", "голубой", "фиолетовый", "сиреневый"],
    "Природные цвета": ["зеленый", "оливковый", "мятный", "хаки"],
    "Натуральные оттенки": [
      "натуральный хлопок",
      "экрю",
      "слоновая_кость",
      "кремовый",
      "песочный",
    ],
    Специальные: ["разноцветный", "многоцветный"],
  };

  return (
    <main className="min-h-screen bg-parchment py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-serif text-4xl text-espresso mb-4">
          Демонстрация цветов
        </h1>
        <p className="text-dark-grey mb-12">
          Все доступные цвета в системе отображения товаров
        </p>

        <div className="space-y-12">
          {Object.entries(colorGroups).map(([groupName, colors]) => (
            <section key={groupName}>
              <h2 className="font-serif text-2xl text-espresso mb-6">
                {groupName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {colors.map((colorKey) => {
                  const colorInfo = COLOR_MAP[colorKey];
                  if (!colorInfo) return null;

                  return (
                    <div
                      key={colorKey}
                      className="flex items-center gap-4 p-4 bg-sand rounded-xl border border-espresso/6"
                    >
                      <div className="flex gap-2">
                        <ColorIndicator color={colorInfo} size="sm" />
                        <ColorIndicator color={colorInfo} size="md" />
                        <ColorIndicator color={colorInfo} size="lg" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-espresso">
                          {colorInfo.name}
                        </div>
                        <div className="text-xs text-taupe font-mono">
                          {colorInfo.hex}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 p-8 bg-sand rounded-2xl border border-espresso/6">
          <h2 className="font-serif text-2xl text-espresso mb-4">
            Примеры использования
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-espresso mb-2">
                Один цвет: "Бежевый"
              </h3>
              <div className="flex gap-2">
                <ColorIndicator color={COLOR_MAP.бежевый!} size="lg" />
              </div>
            </div>

            <div>
              <h3 className="font-medium text-espresso mb-2">
                Несколько цветов: "Белый, Бежевый, Серый"
              </h3>
              <div className="flex gap-2">
                <ColorIndicator color={COLOR_MAP.белый!} size="lg" />
                <ColorIndicator color={COLOR_MAP.бежевый!} size="lg" />
                <ColorIndicator color={COLOR_MAP.серый!} size="lg" />
              </div>
            </div>

            <div>
              <h3 className="font-medium text-espresso mb-2">
                Разноцветный товар
              </h3>
              <div className="flex gap-2">
                <ColorIndicator color={COLOR_MAP.разноцветный!} size="lg" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
