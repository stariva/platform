import Image from "next/image";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { APPLY_MESSAGE, audiences, moodLooks, PARTNER_TERMS } from "../_data";

const MOSAIC_MOODS = ["Свадьба", "Марокко", "Море", "Закат"];
const mosaic = moodLooks.filter((look) => MOSAIC_MOODS.includes(look.mood));

const highlights = [
  { value: PARTNER_TERMS.referralReward, label: "С оплаченного заказа" },
  {
    value: PARTNER_TERMS.volumeDiscount,
    label: `На заказ от ${PARTNER_TERMS.volumeFrom} изделий`,
  },
  { value: "По меркам", label: "Клиентки или модели" },
];

export function PartnersHero() {
  return (
    <section className="relative overflow-hidden bg-espresso text-parchment">
      <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 pt-32 pb-16 lg:pt-40 lg:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="label-caps text-parchment/60 text-[11px]">
              Партнёрам
            </span>
            <span className="w-6 h-px bg-parchment/30" />
            <span className="label-caps text-parchment text-[11px]">
              Фотографам и стилистам
            </span>
          </div>
          <h1
            className="font-serif leading-[1.1] mb-6 text-balance"
            style={{ fontSize: "clamp(36px, 5.5vw, 68px)" }}
          >
            Платья макраме
            <br />
            <span className="italic">для ваших съёмок и клиенток</span>
          </h1>
          <p
            className="text-parchment/75 leading-relaxed mb-10 max-w-xl"
            style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
          >
            Рекомендуйте Stariva клиенткам и получайте вознаграждение,
            заказывайте образы для съёмок по партнёрским условиям или приходите
            с идеей совместной съёмки. Каждое платье плетём вручную по меркам.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#apply"
              className="inline-flex items-center gap-3 bg-parchment text-espresso px-7 py-3.5 rounded-full label-caps-md hover:bg-linen transition-colors"
            >
              Стать партнёром
            </a>
            <ContactMasterButton
              source="partners_hero"
              message={APPLY_MESSAGE}
              className="inline-flex items-center gap-3 bg-white/10 border border-white/25 text-white px-7 py-3.5 rounded-full label-caps-md hover:bg-white/20 transition-colors"
            >
              Написать Ольге
            </ContactMasterButton>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 sm:flex sm:flex-wrap sm:gap-8 lg:gap-14">
            {highlights.map((h) => (
              <div key={h.label}>
                <div className="font-serif text-3xl leading-none mb-1">
                  {h.value}
                </div>
                <div className="label-caps text-parchment/60 text-[11px]">
                  {h.label}
                </div>
              </div>
            ))}
          </div>

          <nav
            aria-label="Кому подходит"
            className="mt-10 flex flex-wrap gap-2"
          >
            {audiences.map((a) => (
              <a
                key={a.id}
                href={`#${a.id}`}
                className="rounded-full border border-parchment/20 px-4 py-2 text-[13px] text-parchment/85 hover:bg-parchment/10 transition-colors"
              >
                {a.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {mosaic.map((look, i) => (
            <div
              key={look.href}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-taupe/30 ${i % 2 === 1 ? "translate-y-8 lg:translate-y-12" : ""}`}
            >
              <Image
                src={look.image}
                alt={look.name}
                fill
                sizes="(min-width: 1024px) 22vw, 50vw"
                className="object-cover object-top"
                priority={i < 2}
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-parchment/90 px-3 py-1 label-caps text-[10px] text-espresso backdrop-blur-sm">
                {look.mood}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
