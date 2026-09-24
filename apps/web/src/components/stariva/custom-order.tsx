import Link from "next/link";
import { CustomOrderForm } from "./custom-order-form";
import { PhoneIcon, TelegramIcon } from "./icons";

export function CustomOrder() {
  return (
    <section id="custom-order" className="py-12 lg:py-20 bg-sand">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16 items-start">
        <div>
          <p className="label-caps text-terracotta mb-4">Обсудим вашу идею</p>
          <h2 className="font-serif text-4xl lg:text-5xl text-espresso leading-[1.08] text-balance">
            Ваш образ.
            <br />
            <span className="italic">Ваши мерки.</span>
          </h2>
          <p className="mt-5 text-espresso/75 leading-relaxed max-w-md">
            Платье для отпуска, топ на каждый день или туника для особенного
            случая — расскажите о своём образе. Ольга поможет с мерками, выбором
            цвета и плетения. Стоимость и срок обсудим до оплаты.
          </p>
          <p className="mt-4 text-sm text-taupe">
            Отвечаем в рабочее время: пн–сб, 10:00–20:00 МСК.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://t.me/Olga_Stariva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-espresso/20 px-5 py-3 text-sm text-espresso hover:border-terracotta"
            >
              <TelegramIcon className="w-4 h-4" />
              Написать Ольге
            </a>
            <a
              href="tel:+79778722546"
              className="inline-flex items-center gap-2 px-2 py-3 text-sm text-espresso"
            >
              <PhoneIcon className="w-4 h-4" />
              +7 977 872 25 46
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
