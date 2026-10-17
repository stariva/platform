import { MessageCircleIcon } from "lucide-react";
import Image from "next/image";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { BULK_DISCOUNT, MAX_ORDER_ITEMS } from "@/lib/b2b/order";
import { RESORT_MESSAGE } from "../_data";
import { DownloadIcon } from "./download-icon";

const stats = [
  { value: `1–${MAX_ORDER_ITEMS}`, label: "изделий\nв заказе" },
  {
    value: `−${BULK_DISCOUNT.percent}%`,
    label: `от ${BULK_DISCOUNT.minItems}\nизделий`,
  },
  { value: "2–6", label: "недель\nизготовления" },
  { value: "0", label: "выездов —\nвсё по фото" },
];

export function ResortHero() {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="https://cdn.stariva.ru/site/images/resort/hero-lake.webp"
          alt="Макраме-гамак и светильники на террасе у озера на закате"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-near-black/80 via-near-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-near-black/40 via-near-black/10 to-transparent" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 pb-16 lg:pb-24 pt-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="label-caps text-white/60 text-[11px]">
              Для бизнеса
            </span>
            <span className="w-6 h-px bg-white/30" />
            <span className="label-caps text-terracotta text-[11px]">
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
            Абажуры, панно и кашпо из хлопка для домиков, веранд и ресепшна —
            серией в одном стиле. Плету сама, заказ по фото, отправляю готовое
            по России.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#order"
              className="inline-flex items-center gap-3 bg-terracotta text-parchment px-7 py-3.5 rounded-full label-caps-md hover:bg-terracotta-dark transition-colors"
            >
              Посчитать заказ
            </a>
            <ContactMasterButton
              source="resort_hero"
              message={RESORT_MESSAGE}
              className="inline-flex items-center gap-3 bg-white/10 border border-white/25 text-white px-7 py-3.5 rounded-full label-caps-md hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <MessageCircleIcon className="w-4 h-4" strokeWidth={1.3} />
              Написать Ольге
            </ContactMasterButton>
          </div>
          <a
            href="/api/kp/resort"
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex items-center gap-2 text-white/75 text-[13px] underline underline-offset-4 decoration-white/30 hover:text-white hover:decoration-white transition-colors"
          >
            <DownloadIcon />
            Коммерческое предложение для руководства
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit">
          {stats.map((s) => (
            <div
              key={s.label}
              className="px-7 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[110px]"
            >
              <span className="font-serif text-white text-3xl lg:text-4xl leading-none">
                {s.value}
              </span>
              <span className="label-caps text-white/75 text-[11px] leading-tight whitespace-pre">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
