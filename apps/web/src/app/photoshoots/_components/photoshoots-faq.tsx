import Link from "next/link";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { faq } from "../_data";

export function PhotoshootsFaq() {
  return (
    <section className="py-20 lg:py-28 bg-off-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12 text-center">
            <p className="label-caps text-terracotta text-[11px] mb-4">
              Частые вопросы
            </p>
            <h2
              className="font-serif text-near-black"
              style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
            >
              Вопросы о платьях для съёмок
            </h2>
          </div>

          <dl className="divide-y divide-espresso/10">
            {faq.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-serif text-near-black text-[17px] mb-3">
                  {item.q}
                </dt>
                <dd className="text-dark-grey text-[14px] leading-relaxed">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-14 rounded-2xl bg-espresso px-6 py-10 lg:px-12 text-center">
            <h2 className="font-serif text-parchment text-2xl lg:text-3xl text-balance">
              Расскажите, куда едете — подберём образ
            </h2>
            <p className="mt-3 text-parchment/70 text-[14px]">
              Ответим в удобном вам мессенджере в рабочее время: пн–сб,
              10:00–20:00 МСК.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <ContactMasterButton
                source="photoshoots_faq"
                message="Здравствуйте, Ольга! Хочу подобрать образ для фотосессии."
                className="inline-flex items-center bg-terracotta text-parchment px-7 py-3.5 rounded-full label-caps-md hover:bg-terracotta-dark transition-colors"
              >
                Написать мастеру
              </ContactMasterButton>
              <Link
                href="/catalog/clothes"
                className="inline-flex items-center border border-parchment/30 text-parchment px-7 py-3.5 rounded-full label-caps-md hover:bg-parchment/10 transition-colors"
              >
                Весь каталог одежды
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
