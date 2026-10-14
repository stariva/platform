import { terms, termsNote } from "../_data";

export function DesignersTerms() {
  return (
    <section id="terms" className="scroll-mt-24 py-28 lg:py-40">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-16 lg:mb-20 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="label-caps text-terracotta tracking-widest mb-4">
              Условия партнёрства
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
              Выгодно вам
              <br />
              <span className="text-taupe">и вашему заказчику</span>
            </h2>
          </div>
          <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
            Отдельные условия для дизайнеров, архитекторов и комплектаторов —
            без минимальной суммы заказа.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-espresso/8 border border-espresso/8 rounded-2xl overflow-hidden">
          {terms.map((term) => (
            <div
              key={term.title}
              className="bg-parchment p-8 lg:p-10 flex flex-col gap-4"
            >
              <span className="font-serif text-5xl text-terracotta/80 leading-none">
                {term.value}
              </span>
              <h3 className="font-serif text-xl lg:text-2xl text-espresso leading-tight">
                {term.title}
              </h3>
              <p className="text-taupe leading-[1.8] text-[14px]">
                {term.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-taupe text-[13px] leading-relaxed max-w-3xl">
          {termsNote}
        </p>
      </div>
    </section>
  );
}
