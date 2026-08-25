"use client";

import { motion } from "motion/react";
import Image from "next/image";

const gallery = [
  { src: "/images/atmosphere-1.jpg", caption: "Спальня — закатный свет" },
  { src: "/images/atmosphere-2.jpg", caption: "Гостиная — деталь" },
  { src: "/images/atmosphere-3.jpg", caption: "Платье на льне" },
];

export function Atmosphere() {
  return (
    <section id="story" className="py-20 lg:py-32">
      {/* Quote */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mb-14 lg:mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-2 lg:pt-6">
            <div className="label-caps text-terracotta flex items-center gap-3">
              <span className="w-8 h-px bg-terracotta" />
              Манифест
            </div>
          </div>
          <motion.blockquote
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-9 lg:col-start-4"
          >
            <p className="font-serif text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-espresso leading-[1.1] tracking-tight text-balance">
              «Настоящий уют создаётся{" "}
              <span className="italic text-terracotta">руками мастера</span> —
              нитка за ниткой, узел за узлом.»
            </p>
          </motion.blockquote>
        </div>
      </div>

      {/* Horizontal scroll gallery */}
      <div className="relative">
        <div className="atmosphere-scroll flex gap-4 lg:gap-6 overflow-x-auto px-6 lg:px-10 pb-6 snap-x snap-mandatory">
          {gallery.map((g) => (
            <div
              key={g.src}
              className="snap-center shrink-0 w-[82vw] sm:w-[60vw] md:w-[48vw] lg:w-[36vw] xl:w-[32vw]"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-sand">
                <Image
                  src={g.src}
                  alt={g.caption}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 82vw, (max-width: 768px) 60vw, (max-width: 1024px) 48vw, (max-width: 1280px) 36vw, 32vw"
                />
              </div>
              <div className="label-caps text-taupe mt-3">{g.caption}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand story */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-20 lg:mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <Image
                src="/images/craftswoman.jpg"
                alt="Мастер за работой — плетение макраме"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <span className="label-caps text-parchment/95 mix-blend-difference">
                  Мастерская
                </span>
                <span className="label-caps text-parchment/95 mix-blend-difference">
                  Зима 2026
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-terracotta" />О бренде
            </div>
            <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl text-espresso leading-[1.1] tracking-tight text-balance mb-8">
              Мастер одного — <span className="italic">из Подмосковья</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-espresso/80 leading-[1.75]">
              <p className="text-pretty">
                Stariva начиналась в 2018 году с одной деревянной рамы и желания
                плести узлы по старым русским образцам. Сегодня у меня своя
                мастерская, где пахнет хлопком, пчелиным воском и свежим чаем.
              </p>
              <p className="text-pretty">
                Каждый абажур — это{" "}
                <span className="text-espresso font-medium">12+ часов</span>{" "}
                ручного труда. Я использую только натуральный хлопок и льняные
                нити российских и португальских производителей — никакого
                синтетического волокна, никаких покрытий и пропиток.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 pt-8 border-t border-espresso/10">
              {[
                { v: "8", l: "лет ручной работы" },
                { v: "500+", l: "изделий в домах" },
                { v: "73", l: "города доставки" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-serif text-4xl lg:text-5xl text-terracotta leading-none">
                    {s.v}
                  </div>
                  <div className="label-caps text-taupe mt-2">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
