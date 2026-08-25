"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const directions = [
  {
    id: "clothes",
    index: "01",
    label: "Одежда",
    sublabel: "Платья · Топы · Накидки",
    href: "/catalog/clothes",
    image: "/images/home/hero-clothes.png",
    objectPosition: "center 20%",
    accent: "#b85c38",
    tag: "Летняя коллекция 2026",
    headline: ["Одежда,", "сотканная", "вручную"],
    desc: "Платья и топы из натурального хлопка — каждое изделие уникально и создаётся под вас.",
  },
  {
    id: "interior",
    index: "02",
    label: "Интерьер",
    sublabel: "Абажуры · Вигвамы · Мобили",
    href: "/catalog/interior",
    image: "/images/home/hero-interior.png",
    objectPosition: "center center",
    accent: "#7a6e5f",
    tag: "Для вашего дома",
    headline: ["Свет и тепло", "в каждом", "углу"],
    desc: "Абажуры ручного плетения — превращают свет в тёплую атмосферу, а пространство — в уют.",
  },
  {
    id: "decor",
    index: "03",
    label: "Декор",
    sublabel: "Панно · Плейсменты · Кашпо",
    href: "/catalog/interior",
    image: "/images/home/hero-decor.png",
    objectPosition: "center center",
    accent: "#8c7b6b",
    tag: "Детали, которые важны",
    headline: ["Декор, который", "расскажет", "вашу историю"],
    desc: "Панно, плейсменты и кашпо из хлопка — детали, которые завершают образ любого интерьера.",
  },
];

export function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = directions[active] ?? directions[0]!;

  // Auto-advance every 5 seconds unless user interacted
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      setActive((prev) => (prev + 1) % directions.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [paused]);

  return (
    <section className="relative h-[100dvh] min-h-[640px] max-h-[1080px] overflow-hidden bg-espresso">
      {/* Background images — all preloaded, cross-fade */}
      {directions.map((dir, i) => (
        <motion.div
          key={dir.id}
          initial={{ opacity: i === 0 ? 1 : 0 }}
          animate={{ opacity: i === active ? 1 : 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={dir.image}
            alt={dir.label}
            fill
            className="object-cover"
            style={{ objectPosition: dir.objectPosition }}
            priority={i === 0}
            sizes="100vw"
            quality={100}
            unoptimized
          />
        </motion.div>
      ))}

      {/* Overlay: only bottom gradient + subtle top vignette, no heavy dark */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        {/* top vignette */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-espresso/40 to-transparent" />
        {/* bottom gradient for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-espresso/75 via-espresso/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between max-w-[1440px] mx-auto px-5 lg:px-12 pt-[60px] lg:pt-[68px] pb-10 lg:pb-16">
        {/* Tag */}
        <div className="pt-8 lg:pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.tag}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="inline-flex items-center gap-2"
            >
              <span className="w-5 h-px bg-white/50" />
              <span className="label-caps text-white/60">{current.tag}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Headline + CTA */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.h1
                key={`${current.id}-h`}
                initial={{ opacity: 0, y: 28, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(2px)" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-white text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.95] tracking-tight text-balance drop-shadow-[0_2px_24px_rgba(0,0,0,0.25)]"
              >
                {current.headline.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: headline lines are static and positional
                  <span key={i} className="block">
                    {i === 2 ? (
                      <em
                        className="not-italic"
                        style={{
                          color: current.accent,
                          textShadow:
                            "0 2px 16px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.7)",
                        }}
                      >
                        {line}
                      </em>
                    ) : (
                      line
                    )}
                  </span>
                ))}
              </motion.h1>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p
                key={`${current.id}-p`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, delay: 0.15 }}
                className="mt-6 text-white/80 text-base lg:text-xl max-w-lg leading-[1.7] drop-shadow-sm"
              >
                {current.desc}
              </motion.p>
            </AnimatePresence>

            <motion.div
              className="mt-9 flex flex-wrap items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <Link
                href={current.href}
                className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-white text-espresso label-caps-md hover:bg-parchment shadow-[0_4px_24px_rgba(0,0,0,0.18)] transition-all duration-300"
              >
                Смотреть коллекцию
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path
                    d="M2 7h10M8 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 text-white/70 label-caps-md hover:text-white transition-colors"
              >
                Весь каталог
              </Link>
            </motion.div>
          </div>

          {/* Direction switcher */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper pauses auto-advance on hover, not interactive itself */}
          <div
            className="flex lg:flex-col gap-1.5 lg:gap-5 px-4 py-3 lg:px-5 lg:py-4 rounded-2xl bg-black/25 backdrop-blur-md"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {directions.map((dir, i) => (
              <button
                key={dir.id}
                type="button"
                onClick={() => {
                  setActive(i);
                  setPaused(true);
                }}
                className={`group flex items-center gap-3 text-left transition-all duration-300 ${
                  i === active ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                {/* Progress bar for active */}
                <div className="shrink-0 w-0.5 h-11 bg-white/20 relative overflow-hidden rounded-full">
                  {i === active && (
                    <motion.div
                      className="absolute top-0 left-0 w-full rounded-full"
                      style={{ backgroundColor: dir.accent }}
                      initial={{ height: "0%" }}
                      animate={{ height: "100%" }}
                      transition={{ duration: paused ? 0 : 5, ease: "linear" }}
                      key={`${active}-progress`}
                    />
                  )}
                  {i !== active && (
                    <div className="absolute inset-0 bg-white/35 rounded-full" />
                  )}
                </div>
                <div>
                  <div className="label-caps text-white/60 text-[10px] leading-none mb-1">
                    {dir.index}
                  </div>
                  <div className="text-white font-serif text-[17px] lg:text-[20px] leading-snug drop-shadow-sm">
                    {dir.label}
                  </div>
                  {i === active && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="text-white/70 text-[12px] mt-0.5"
                    >
                      {dir.sublabel}
                    </motion.div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-1.5 opacity-40">
        <span className="label-caps text-white text-[9px]">Скролл</span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 4l5 5 5-5"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
