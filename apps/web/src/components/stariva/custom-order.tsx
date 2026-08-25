"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { CustomOrderForm } from "./custom-order-form";
import { OzonIcon, PhoneIcon, TelegramIcon } from "./icons";

export function CustomOrder() {
  return (
    <section id="order" className="py-20 lg:py-32 bg-sand">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Heading */}
        <div className="max-w-2xl mb-12 lg:mb-16">
          <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
            <span className="w-8 h-px bg-terracotta" />
            Индивидуальный заказ
          </div>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso leading-[1.05] tracking-tight text-balance mb-6">
            Создадим ваш <span className="italic">идеальный</span> светильник
          </h2>
          <p className="text-espresso/75 leading-[1.75] text-lg text-pretty">
            Прикиньте стоимость в калькуляторе, опишите задумку и пришлите
            фото-вдохновение — я предложу дизайн и точную цену. Отвечу в течение
            часа в рабочее время.
          </p>
        </div>

        {/* Calculator + form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <CustomOrderForm />
        </motion.div>

        {/* Quick contacts */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <a
            href="https://t.me/Olga_Stariva"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 px-6 py-4 rounded-full bg-terracotta text-parchment hover:bg-espresso transition-colors duration-300"
          >
            <TelegramIcon className="w-5 h-5 shrink-0" />
            <span className="label-caps-md">Написать в Telegram</span>
          </a>

          <a
            href="tel:+79778722546"
            className="group flex items-center gap-4 px-6 py-4 rounded-full border border-espresso/20 text-espresso hover:border-terracotta hover:text-terracotta transition-colors duration-300"
          >
            <PhoneIcon className="w-5 h-5 shrink-0" />
            <span className="font-serif text-xl">+7 977 872 25 46</span>
          </a>

          <Link
            href="https://www.ozon.ru/seller/stariva-makrame-odezhda-dekor-vyazanye-sumki-izdeliya-iz-shnura/"
            className="group flex items-center gap-3 px-6 py-4 rounded-full bg-[#005BFF]/8 hover:bg-[#005BFF]/15 text-[#005BFF] transition-colors duration-200"
          >
            <OzonIcon className="w-4 h-4 shrink-0" />
            <span className="label-caps text-[12px]">Готовое на Ozon</span>
          </Link>
        </div>

        <div className="mt-10 pt-8 border-t border-espresso/15 text-sm text-espresso/70 leading-relaxed">
          <span className="block mb-1 label-caps text-taupe">
            Рабочее время
          </span>
          Пн–Сб, с 10:00 до 20:00. Воскресенье — выходной.
        </div>
      </div>
    </section>
  );
}
