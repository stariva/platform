import { advantages } from "../_data";

export function ResortAdvantages() {
  return (
    <section className="py-24 lg:py-36 bg-off-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="mb-14">
          <p className="label-caps text-terracotta text-[10px] mb-4">
            Почему выбирают нас
          </p>
          <h2
            className="font-serif text-near-black leading-tight max-w-lg"
            style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
          >
            Шесть причин работать со Stariva
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {advantages.map((a) => (
            <div
              key={a.number}
              className="bg-white rounded-2xl p-7 border border-espresso/6 hover:border-espresso/14 transition-colors"
            >
              <div
                className="font-serif text-terracotta/40 text-4xl leading-none mb-5 select-none"
                aria-hidden="true"
              >
                {a.number}
              </div>
              <h3 className="font-serif text-near-black text-[18px] leading-snug mb-3">
                {a.title}
              </h3>
              <p className="text-dark-grey text-[13px] leading-relaxed">
                {a.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
