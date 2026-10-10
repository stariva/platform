"use client";

import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { CONTACTS } from "@/lib/contacts";
import { ContactMasterButton } from "./contact-master";
import { CustomOrderForm } from "./custom-order-form";
import { useHomeOrder } from "./home-order-context";
import { PhoneIcon } from "./icons";

export function CustomOrder() {
  const { productType } = useHomeOrder();
  const clothes = productType === "clothes";
  const lampshade = productType === "lampshade";
  return (
    <section id="custom-order" className="py-12 lg:py-20 bg-sand">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16 items-start">
        <div>
          <p className="label-caps text-terracotta mb-4">Обсудим вашу идею</p>
          <h2 className="font-serif text-4xl lg:text-5xl text-espresso leading-[1.08] text-balance">
            {clothes ? "Ваш образ." : lampshade ? "Ваш свет." : "Ваша идея."}
            <br />
            <span className="italic">
              {clothes ? "Ваши мерки." : "Ручная работа."}
            </span>
          </h2>
          <p className="mt-5 text-espresso/75 leading-relaxed max-w-md">
            {clothes
              ? "Платье для отпуска, топ на каждый день или туника для особенного случая — расскажите о своём образе. Ольга поможет с мерками, выбором цвета и плетения."
              : lampshade
                ? "Расскажите, для какого пространства нужен абажур. Ольга поможет подобрать размер, цвет и плетение, уточнит крепление и комплектацию."
                : "Панно, декор для стола или своя задумка — расскажите, что хочется добавить в интерьер. Ольга поможет выбрать размер, материал и плетение."}{" "}
            Стоимость и срок обсудим до оплаты.
          </p>
          <p className="mt-4 text-sm text-taupe">
            Отвечаем в рабочее время: пн–сб, 10:00–20:00 МСК.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ContactMasterButton
              source="custom_order"
              message={`Здравствуйте, Ольга! Хочу обсудить ${
                clothes ? "одежду" : lampshade ? "абажур" : "изделие"
              } на заказ.`}
              className="inline-flex items-center gap-2 rounded-full border border-espresso/20 px-5 py-3 text-sm text-espresso hover:border-terracotta"
            >
              <MessageCircleIcon className="w-4 h-4" strokeWidth={1.3} />
              Написать мастеру
            </ContactMasterButton>
            <a
              href={CONTACTS.phoneHref}
              className="inline-flex items-center gap-2 px-2 py-3 text-sm text-espresso"
            >
              <PhoneIcon className="w-4 h-4" />
              {CONTACTS.phone}
            </a>
          </div>
          <Link
            href="/about"
            className="inline-block mt-5 text-sm text-taupe underline underline-offset-4"
          >
            Познакомиться с мастером
          </Link>
        </div>
        <div id="order" className="scroll-mt-24">
          <CustomOrderForm />
        </div>
      </div>
    </section>
  );
}
