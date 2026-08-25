import Image from "next/image";
import { DownloadIcon } from "./download-icon";

const stats = [
  { value: "50+", label: "Проектов для отдыха" },
  { value: "15 лет", label: "Срок службы изделий" },
  { value: "24ч", label: "Подготовим КП" },
];

export function ResortHero() {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/resort/hero.png"
          alt="Макраме-декор на террасе базы отдыха"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-near-black/80 via-near-black/30 to-transparent" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 pb-16 lg:pb-24 pt-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="label-caps text-white/60 text-[10px]">
              Для бизнеса
            </span>
            <span className="w-6 h-px bg-white/30" />
            <span className="label-caps text-terracotta text-[10px]">
              Базы отдыха
            </span>
          </div>
          <h1
            className="font-serif text-white leading-[1.1] mb-6"
            style={{ fontSize: "clamp(36px, 6vw, 72px)" }}
          >
            Макраме для баз отдыха,
            <br />
            глэмпингов и эко-отелей
          </h1>
          <p
            className="text-white/75 leading-relaxed mb-10 max-w-xl"
            style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
          >
            Превращаем типовое пространство в атмосферное место, где гости
            задерживаются и возвращаются. Натуральный хлопок, авторский дизайн,
            монтаж под ключ.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="/api/kp/resort"
              download="stariva-kp-bazy-otdykha.pdf"
              className="inline-flex items-center gap-3 bg-terracotta text-parchment px-7 py-3.5 rounded-full label-caps-md hover:bg-terracotta-dark transition-colors"
            >
              <DownloadIcon />
              Скачать КП (PDF)
            </a>
            <a
              href="https://t.me/Olga_Stariva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white/10 border border-white/25 text-white px-7 py-3.5 rounded-full label-caps-md hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              Обсудить проект
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-14 flex flex-wrap gap-8 lg:gap-16">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-serif text-white text-3xl leading-none mb-1">
                {s.value}
              </div>
              <div className="label-caps text-white/50 text-[10px]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
