import { faq } from "../_data";

export function ResortFaq() {
  return (
    <section className="py-24 lg:py-32 bg-off-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12 text-center">
            <p className="label-caps text-terracotta text-[10px] mb-4">
              Частые вопросы
            </p>
            <h2
              className="font-serif text-near-black"
              style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
            >
              Вопросы о работе с базами отдыха
            </h2>
          </div>

          <dl className="divide-y divide-espresso/8">
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
        </div>
      </div>
    </section>
  );
}
