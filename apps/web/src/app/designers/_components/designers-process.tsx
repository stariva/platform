import { workSteps } from "../_data";

export function DesignersProcess() {
  return (
    <section className="py-28 lg:py-40 bg-espresso text-parchment">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-16 lg:mb-20">
          <p className="label-caps text-linen/50 tracking-widest mb-4">
            Процесс
          </p>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-parchment leading-[1.05]">
            От брифа до объекта
          </h2>
        </div>

        <div>
          {workSteps.map((item) => (
            <div
              key={item.step}
              className="grid grid-cols-[56px_1fr] lg:grid-cols-[100px_1fr] gap-6 lg:gap-12 py-9 border-t border-parchment/8 group"
            >
              <div className="font-serif text-4xl lg:text-5xl text-parchment/15 group-hover:text-parchment/40 transition-colors duration-300 leading-none pt-1">
                {item.step}
              </div>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-16">
                <h3 className="font-serif text-xl lg:text-2xl text-parchment lg:w-64 flex-shrink-0">
                  {item.title}
                </h3>
                <p className="text-parchment/70 text-[14px] leading-[1.85] lg:max-w-2xl">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
          <div className="border-t border-parchment/8" />
        </div>
      </div>
    </section>
  );
}
