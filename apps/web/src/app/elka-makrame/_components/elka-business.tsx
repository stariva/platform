import { ContactMasterButton } from "@/components/stariva/contact-master";
import { BUSINESS_POINTS, PHONE_HREF, PHONE_LABEL } from "../_data";
import { TrackedLink } from "./tracked-link";

export function ElkaBusiness() {
  return (
    <section
      id="business"
      aria-labelledby="business-title"
      className="bg-espresso text-parchment scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24 grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20">
        <div>
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Для бизнеса
          </p>
          <h2
            id="business-title"
            className="font-serif leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Новогоднее оформление для отелей, ресторанов и офисов
          </h2>
          <p className="text-parchment/75 leading-relaxed mb-8 max-w-lg">
            Напишите, какая модель и сколько ёлок нужно, — в течение дня
            подготовим расчёт со сроками и стоимостью партии.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <ContactMasterButton
              source="elka_b2b"
              goal="elka_b2b_telegram"
              message="Здравствуйте, Ольга! Хочу получить расчёт новогоднего оформления в технике макраме."
              className="inline-flex items-center justify-center rounded-2xl bg-terracotta hover:bg-terracotta-dark text-parchment px-8 py-4 transition-colors"
            >
              Получить расчёт у мастера
            </ContactMasterButton>
            <TrackedLink
              href={PHONE_HREF}
              goal="elka_b2b_phone"
              className="inline-flex items-center justify-center rounded-2xl border border-parchment/25 hover:border-parchment px-8 py-4 transition-colors"
            >
              {PHONE_LABEL}
            </TrackedLink>
          </div>
        </div>

        <ul className="grid sm:grid-cols-2 gap-px bg-parchment/10 rounded-[24px] overflow-hidden">
          {BUSINESS_POINTS.map((point, index) => (
            <li key={point.title} className="bg-espresso p-6 lg:p-8">
              <span className="font-serif text-terracotta text-lg">
                0{index + 1}
              </span>
              <h3 className="font-serif text-2xl mt-3 mb-2">{point.title}</h3>
              <p className="text-parchment/70 leading-relaxed text-sm">
                {point.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
