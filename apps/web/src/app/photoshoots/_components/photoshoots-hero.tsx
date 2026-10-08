import Image from "next/image";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { scenarios } from "../_data";

export function PhotoshootsHero() {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/photoshoots/hero-morocco.png"
          alt="Лагерь бедуинов в дюнах Сахары на закате, Марокко"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-near-black/85 via-near-black/35 to-near-black/10" />
      </div>

      <div className="relative w-full max-w-[1440px] mx-auto px-5 lg:px-12 pb-16 lg:pb-24 pt-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="label-caps text-white/60 text-[11px]">Одежда</span>
            <span className="w-6 h-px bg-white/30" />
            <span className="label-caps text-terracotta text-[11px]">
              Для фотосессий
            </span>
          </div>
          <h1
            className="font-serif text-white leading-[1.1] mb-6 text-balance"
            style={{ fontSize: "clamp(36px, 6vw, 72px)" }}
          >
            Платья макраме
            <br />
            <span className="italic">для фотосессий в путешествиях</span>
          </h1>
          <p
            className="text-white/80 leading-relaxed mb-10 max-w-xl"
            style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
          >
            Марокко, свадьба у моря, греческие острова или road trip по пустыне
            — подберём образ под локацию и сплетём платье по вашим меркам к дате
            вылета.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#scenarios"
              className="inline-flex items-center gap-3 bg-terracotta text-parchment px-7 py-3.5 rounded-full label-caps-md hover:bg-terracotta-dark transition-colors"
            >
              Выбрать локацию
            </a>
            <ContactMasterButton
              source="photoshoots_hero"
              message="Здравствуйте, Ольга! Хочу подобрать образ для фотосессии."
              className="inline-flex items-center gap-3 bg-white/10 border border-white/25 text-white px-7 py-3.5 rounded-full label-caps-md hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              Подобрать образ с Ольгой
            </ContactMasterButton>
          </div>
        </div>

        <nav aria-label="Локации" className="mt-14 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-white/25 px-4 py-2 text-[13px] text-white/90 hover:bg-white/15 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
