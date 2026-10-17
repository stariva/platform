import Image from "next/image";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { heroLooks, PARTNER_MESSAGE, PARTNER_TERMS } from "../_data";

export function PartnersHero() {
  return (
    <section className="relative overflow-hidden bg-espresso text-parchment">
      <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 pt-32 pb-16 lg:pt-40 lg:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <p className="label-caps text-parchment/60 text-[11px] mb-6">
            Партнёрам
          </p>
          <h1
            className="font-serif leading-[1.1] mb-6 text-balance"
            style={{ fontSize: "clamp(36px, 5.5vw, 68px)" }}
          >
            Посоветуйте Stariva —
            <br />
            <span className="italic">
              клиентка получит −{PARTNER_TERMS.clientDiscount}
            </span>
          </h1>
          <p
            className="text-parchment/75 leading-relaxed mb-10 max-w-xl"
            style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
          >
            Знаете, кому подойдёт платье или декор макраме? Рекомендуйте
            Stariva: клиентка называет ваше имя и получает скидку{" "}
            {PARTNER_TERMS.clientDiscount} на первый заказ, а Ольга сама всё
            обсудит и сплетёт. Без анкет и договоров.
          </p>

          <ContactMasterButton
            source="partners_hero"
            message={PARTNER_MESSAGE}
            className="inline-flex items-center gap-3 bg-parchment text-espresso px-7 py-3.5 rounded-full label-caps-md hover:bg-linen transition-colors"
          >
            Написать Ольге
          </ContactMasterButton>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {heroLooks.map((look, i) => (
            <div
              key={look.href}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-taupe/30 ${i % 2 === 1 ? "translate-y-8 lg:translate-y-12" : ""}`}
            >
              <Image
                src={look.image}
                alt={look.name}
                fill
                sizes="(min-width: 1024px) 22vw, 50vw"
                className="object-cover object-top"
                priority={i < 2}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
