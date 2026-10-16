"use client";

import { CONTACTS } from "@/lib/contacts";
import { PRODUCT_TYPES } from "@/lib/custom-order/pricing";
import { ContactOptions } from "./contact-master";
import { useHomeOrder } from "./home-order-context";

const tips: Record<string, { subject: string; mention: string }> = {
  lampshade: {
    subject: "абажур",
    mention: "диаметр и высоту, цвет, куда повесите и тип крепления",
  },
  clothes: {
    subject: "одежду",
    mention: "что за вещь, цвет, длину, рост и обхваты, если знаете",
  },
  bag: {
    subject: "сумку или авоську",
    mention: "размеры, цвет, длину ручек или ремня",
  },
  panel: {
    subject: "панно",
    mention: "ширину и высоту, цвет, нужна ли бахрома",
  },
  tipi: {
    subject: "вигвам или подвесное кресло",
    mention: "что именно нужно, размеры и где будет стоять или висеть",
  },
  "plant-hanger": {
    subject: "подвесное кашпо",
    mention: "диаметр горшка, длину подвеса и количество",
  },
  placemat: {
    subject: "плейсматы для стола",
    mention: "размер, форму и сколько штук нужно",
  },
};
const defaultTip = {
  subject: "изделие",
  mention: "что за изделие, размер, цвет и для какого места",
};

/**
 * Карточка «Написать Ольге» на главной. Клиенты сразу пишут в мессенджер,
 * поэтому вместо формы — каналы связи с готовым текстом под выбранное изделие.
 */
export function CustomOrderCard() {
  const { productType, setProductType } = useHomeOrder();
  const tip = tips[productType ?? ""] ?? defaultTip;
  return (
    <div className="rounded-2xl border border-espresso/10 bg-parchment p-5 sm:p-7 lg:p-8">
      <h3 className="font-serif text-2xl text-espresso">Написать Ольге</h3>
      <p className="mt-2 text-sm text-espresso/75 leading-relaxed">
        Расскажите своими словами, что хотите. Ольга уточнит детали и посчитает
        стоимость.
      </p>
      <fieldset className="mt-5">
        <legend className="text-sm text-espresso">
          Что будем создавать?{" "}
          <span className="text-taupe">· можно не выбирать</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRODUCT_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={productType === item.id}
              onClick={() =>
                setProductType(productType === item.id ? undefined : item.id)
              }
              className="rounded-full border border-espresso/20 px-3.5 py-2 text-sm text-espresso transition-colors hover:border-terracotta aria-pressed:border-terracotta aria-pressed:bg-terracotta aria-pressed:text-parchment"
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="mt-5 text-xs leading-relaxed text-taupe">
        В сообщении пригодится: {tip.mention}. Пришлите фото места или пример,
        который нравится. Не знаете размеры или бюджет — так и напишите,
        поможем.
      </p>
      <ContactOptions
        source="custom_order"
        message={`Здравствуйте, Ольга! Хочу обсудить ${tip.subject} на заказ.`}
      />
      <p className="mt-4 text-xs leading-relaxed text-taupe">
        Отвечаем в рабочее время: {CONTACTS.hours}. Стоимость, срок и доставку
        согласуем до оплаты.
      </p>
    </div>
  );
}
