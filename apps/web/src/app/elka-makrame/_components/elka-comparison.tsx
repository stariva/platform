import { Check, Minus } from "lucide-react";
import { COMPARISON } from "../_data";

function Mark({ value }: { value: boolean }) {
  return value ? (
    <>
      <Check className="size-5 text-sage mx-auto" aria-hidden />
      <span className="sr-only">Да</span>
    </>
  ) : (
    <>
      <Minus className="size-5 text-light-grey mx-auto" aria-hidden />
      <span className="sr-only">Нет</span>
    </>
  );
}

export function ElkaComparison() {
  return (
    <section aria-labelledby="comparison-title" className="bg-white">
      <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Почему макраме
          </p>
          <h2
            id="comparison-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Чем макраме-ёлка лучше живой и искусственной
          </h2>
        </div>

        {/* relative: sr-only внутри ячеек позиционируются absolute и без
            него вылезают за скролл-контейнер, расширяя страницу на телефоне. */}
        <div className="relative overflow-x-auto rounded-[24px] border border-linen">
          {/* На телефоне все четыре колонки помещаются в экран: без
              горизонтального скролла столбцы «Живая ель» и «Искусственная»
              не прячутся за краем. */}
          <table className="w-full text-left">
            <caption className="sr-only">
              Сравнение макраме-ёлки с живой и искусственной елью
            </caption>
            <thead>
              <tr className="bg-parchment">
                <th
                  scope="col"
                  className="pl-3 pr-1 py-3 sm:p-4 lg:p-5 font-normal text-xs sm:text-sm text-text-grey"
                >
                  Критерий
                </th>
                <th
                  scope="col"
                  className="px-1 py-3 sm:p-4 lg:p-5 text-center font-serif text-sm sm:text-lg text-espresso"
                >
                  Макраме
                </th>
                <th
                  scope="col"
                  className="px-1 py-3 sm:p-4 lg:p-5 text-center font-normal text-xs sm:text-sm text-text-grey"
                >
                  Живая ель
                </th>
                <th
                  scope="col"
                  className="px-1 py-3 sm:p-4 lg:p-5 text-center font-normal text-xs sm:text-sm text-text-grey"
                >
                  Искус&shy;ственная
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-t border-linen">
                  <th
                    scope="row"
                    className="pl-3 pr-1 py-3 sm:p-4 lg:p-5 font-normal text-sm sm:text-base text-espresso hyphens-auto sm:hyphens-none"
                  >
                    {row.feature}
                  </th>
                  <td className="px-1 py-3 sm:p-4 lg:p-5 bg-sage-pale/40">
                    <Mark value={row.macrame} />
                  </td>
                  <td className="px-1 py-3 sm:p-4 lg:p-5">
                    <Mark value={row.live} />
                  </td>
                  <td className="px-1 py-3 sm:p-4 lg:p-5">
                    <Mark value={row.artificial} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
