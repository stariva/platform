import { ContactMasterButton } from "@/components/stariva/contact-master";
import { FAQ, PHONE_HREF, PHONE_LABEL } from "../_data";
import { TrackedLink } from "./tracked-link";

export function ElkaFaq() {
  return (
    <section aria-labelledby="faq-title" className="bg-parchment">
      <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-16 lg:py-24 grid lg:grid-cols-[1fr_1.6fr] gap-10">
        <div>
          <p className="label-caps text-terracotta text-[11px] mb-4">Вопросы</p>
          <h2
            id="faq-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(30px, 4vw, 44px)" }}
          >
            Частые вопросы о макраме-ёлке
          </h2>
          <p className="text-dark-grey mb-6">
            Не нашли ответ? Напишите — ответим в течение часа.
          </p>
          <div className="flex flex-col gap-2 text-espresso">
            <ContactMasterButton
              source="elka_faq"
              goal="elka_faq_telegram"
              message="Здравствуйте, Ольга! У меня вопрос про макраме-ёлку."
              className="text-left underline underline-offset-4 hover:text-terracotta"
            >
              Написать мастеру
            </ContactMasterButton>
            <TrackedLink
              href={PHONE_HREF}
              goal="elka_faq_phone"
              className="underline underline-offset-4 hover:text-terracotta"
            >
              {PHONE_LABEL}
            </TrackedLink>
          </div>
        </div>

        <div className="divide-y divide-espresso/10 border-y border-espresso/10">
          {FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-serif text-lg text-espresso [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  className="mt-1 text-2xl leading-none text-terracotta transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-dark-grey leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
