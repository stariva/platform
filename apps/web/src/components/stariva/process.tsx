"use client";

import { motion } from "motion/react";

const steps = [
  {
    n: "01",
    title: "Подбор нитей",
    text: "Вы выбираете оттенок и фактуру: молочный хлопок, льняной экрю, тёплая охра. Я покажу образцы на видеосозвоне или вышлю Почтой.",
  },
  {
    n: "02",
    title: "Плетение узлов",
    text: "Мастер плетёт изделие на деревянной раме, узел за узлом — без спешки. Контрольные фото отправляем вам каждые 3–4 дня.",
  },
  {
    n: "03",
    title: "Осмотр и упаковка",
    text: "Каждое изделие проверяет вторая пара рук. Упаковываем в крафтовую бумагу, лён и подписанную от руки открытку.",
  },
];

export function Process() {
  return (
    <section className="py-20 lg:py-32 bg-parchment">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 mb-14 lg:mb-20">
          <div className="lg:col-span-5">
            <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-terracotta" />
              Как я работаю
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso leading-[1.05] tracking-tight text-balance">
              Три шага <span className="italic">к вашему свету</span>
            </h2>
          </div>
          <p className="lg:col-span-5 lg:col-start-8 text-espresso/75 leading-[1.75] text-pretty self-end">
            Срок изготовления —{" "}
            <span className="text-espresso font-medium">7–14 дней</span>. Слежу
            за каждым этапом лично и сообщаю вам обо всём, что происходит с
            заказом. Без шаблонов и автоответов.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 lg:gap-12">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.7,
                delay: i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative pt-10"
            >
              <span className="absolute top-0 left-0 right-0 h-px bg-espresso/15" />
              <div className="flex items-baseline gap-4 mb-6">
                <span className="font-serif text-5xl lg:text-6xl text-terracotta leading-none">
                  {s.n}
                </span>
                <span className="label-caps text-taupe">шаг</span>
              </div>
              <h3 className="font-serif text-2xl lg:text-3xl text-espresso mb-4 leading-tight">
                {s.title}
              </h3>
              <p className="text-espresso/75 leading-[1.75] text-pretty">
                {s.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
