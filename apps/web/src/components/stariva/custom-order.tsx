"use client";

import Link from "next/link";
import { CustomOrderCard } from "./custom-order-card";
import { useHomeOrder } from "./home-order-context";

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
          <Link
            href="/about"
            className="inline-block mt-5 text-sm text-taupe underline underline-offset-4"
          >
            Познакомиться с мастером
          </Link>
        </div>
        <div id="order" className="scroll-mt-24">
          <CustomOrderCard />
        </div>
      </div>
    </section>
  );
}
