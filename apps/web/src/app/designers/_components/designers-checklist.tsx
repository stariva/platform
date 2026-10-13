import { checklist } from "../_data";

export function DesignersChecklist() {
  return (
    <section className="py-28 lg:py-40">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-14 lg:mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="label-caps text-terracotta tracking-widest mb-4">
              Чек-лист
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
              Что заложить
              <br />
              <span className="text-taupe">в проект заранее</span>
            </h2>
          </div>
          <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
            Вопросы, которые лучше решить до закупки, а не на приёмке объекта.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-20">
          {checklist.map((item, index) => (
            <li
              key={item.title}
              className="grid grid-cols-[40px_1fr] gap-4 py-7 border-t border-espresso/10"
            >
              <span className="font-serif text-2xl text-espresso/25 leading-none pt-0.5">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-serif text-xl text-espresso leading-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-taupe text-[14px] leading-[1.8]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
