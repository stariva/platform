import { faq } from "../_data";

export function DesignersFaq() {
  return (
    <section className="py-28 lg:py-40">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="label-caps text-terracotta tracking-widest mb-4">
              FAQ
            </p>
            <h2 className="font-serif text-[clamp(2rem,4vw,3.5rem)] text-espresso leading-[1.1]">
              Вопросы дизайнеров
            </h2>
          </div>
          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group border border-espresso/10 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-espresso hover:bg-sand transition-colors">
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
                <div className="px-6 pb-5 pt-2 text-taupe text-[15px] leading-[1.8] border-t border-espresso/8">
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
