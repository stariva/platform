import { FAQJsonLd } from "@/components/stariva/json-ld";
import { faq } from "../_data";

export function ResortFaq() {
  return (
    <section className="py-24 lg:py-32 bg-off-white">
      <FAQJsonLd
        items={faq.map((item) => ({ question: item.q, answer: item.a }))}
      />
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <p className="label-caps text-terracotta text-[11px] mb-4">
              Частые вопросы
            </p>
            <h2
              className="font-serif text-near-black"
              style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
            >
              Вопросы о заказе для базы отдыха
            </h2>
          </div>

          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group border border-espresso/10 rounded-xl overflow-hidden bg-white"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-near-black hover:bg-parchment transition-colors">
                  <span className="font-serif text-[17px] leading-snug">
                    {item.q}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180 text-espresso/60"
                  >
                    <path
                      d="M3 6l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <div className="px-6 pb-5 pt-2 text-dark-grey text-[15px] leading-[1.8] border-t border-espresso/8">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
