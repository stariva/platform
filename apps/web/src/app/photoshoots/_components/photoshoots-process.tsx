import { steps } from "../_data";

export function PhotoshootsProcess() {
  return (
    <section className="py-20 lg:py-28 bg-sand">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Как заказать
          </p>
          <h2
            className="font-serif text-near-black leading-[1.1] text-balance"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            Платье к вылету — в четыре шага
          </h2>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl bg-parchment p-6 lg:p-8"
            >
              <span className="font-serif text-terracotta text-3xl leading-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-serif text-near-black text-xl">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] text-dark-grey leading-relaxed">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
