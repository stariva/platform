import { projectItems, projectItemsNote } from "../_data";

export function DesignersAssortment() {
  return (
    <section className="py-28 lg:py-40 bg-sand">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-14 lg:mb-16 max-w-3xl">
          <p className="label-caps text-terracotta tracking-widest mb-4">
            Для спецификации
          </p>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
            Что заказывают
            <br />
            <span className="text-taupe">для общественных интерьеров</span>
          </h2>
          <p className="mt-6 text-taupe text-base leading-[1.8] max-w-xl">
            Все изделия делаются под проект: размер, цвет и плотность плетения
            подбираем под концепцию. В колонке «Что указать в ТЗ» — параметры,
            без которых не получится точный расчёт.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-espresso/10 bg-parchment">
          <div className="hidden lg:grid grid-cols-[1.4fr_1fr_1.2fr_0.7fr] gap-8 px-8 py-4 border-b border-espresso/10 label-caps text-[11px] text-taupe">
            <span>Изделие</span>
            <span>Где работает</span>
            <span>Что указать в ТЗ</span>
            <span className="text-right">Ориентир</span>
          </div>
          <ul className="divide-y divide-espresso/10">
            {projectItems.map((item) => (
              <li
                key={item.title}
                className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1.2fr_0.7fr] gap-3 lg:gap-8 px-6 lg:px-8 py-6"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-serif text-xl lg:text-2xl text-espresso">
                      {item.title}
                    </h3>
                    <span className="lg:hidden font-serif text-lg text-espresso whitespace-nowrap">
                      {item.price}
                    </span>
                  </div>
                  <p className="mt-2 text-taupe text-[14px] leading-[1.75]">
                    {item.body}
                  </p>
                </div>
                <p className="text-espresso/75 text-[14px] leading-[1.75]">
                  <span className="lg:hidden label-caps text-[10px] text-taupe block mb-1">
                    Где работает
                  </span>
                  {item.zones}
                </p>
                <p className="text-espresso/75 text-[14px] leading-[1.75]">
                  <span className="lg:hidden label-caps text-[10px] text-taupe block mb-1">
                    Что указать в ТЗ
                  </span>
                  {item.spec}
                </p>
                <p className="hidden lg:block font-serif text-xl text-espresso text-right whitespace-nowrap">
                  {item.price}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-taupe text-[13px] leading-relaxed max-w-3xl">
          {projectItemsNote}
        </p>
      </div>
    </section>
  );
}
