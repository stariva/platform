import { workSteps } from "../_data";

export function ResortProcess() {
  return (
    <section className="py-24 lg:py-36 bg-espresso text-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="mb-14">
          <p className="label-caps text-terracotta text-[10px] mb-4">
            Как работаем
          </p>
          <h2
            className="font-serif leading-tight max-w-lg"
            style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
          >
            От заявки до готового объекта
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8 rounded-2xl overflow-hidden">
          {workSteps.map((p, i) => (
            <div key={p.step} className="bg-espresso p-8 relative">
              {i < workSteps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-1/2 -right-px w-px h-12 -translate-y-1/2 bg-white/8"
                  aria-hidden="true"
                />
              )}
              <div
                className="font-serif text-terracotta/50 text-5xl leading-none mb-6 select-none"
                aria-hidden="true"
              >
                {p.step}
              </div>
              <h3 className="font-serif text-xl mb-3">{p.title}</h3>
              <p className="text-parchment/60 text-[13px] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
