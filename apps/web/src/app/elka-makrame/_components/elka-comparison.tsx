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

        <div className="overflow-x-auto rounded-[24px] border border-linen">
          <table className="w-full min-w-[560px] text-left">
            <caption className="sr-only">
              Сравнение макраме-ёлки с живой и искусственной елью
            </caption>
            <thead>
              <tr className="bg-parchment">
                <th
                  scope="col"
                  className="p-4 lg:p-5 font-normal text-sm text-text-grey"
                >
                  Критерий
                </th>
                <th
                  scope="col"
                  className="p-4 lg:p-5 text-center font-serif text-lg text-espresso"
                >
                  Макраме
                </th>
                <th
                  scope="col"
                  className="p-4 lg:p-5 text-center font-normal text-sm text-text-grey"
                >
                  Живая ель
                </th>
                <th
                  scope="col"
                  className="p-4 lg:p-5 text-center font-normal text-sm text-text-grey"
                >
                  Искусственная
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-t border-linen">
                  <th
                    scope="row"
                    className="p-4 lg:p-5 font-normal text-espresso"
                  >
                    {row.feature}
                  </th>
                  <td className="p-4 lg:p-5 bg-sage-pale/40">
                    <Mark value={row.macrame} />
                  </td>
                  <td className="p-4 lg:p-5">
                    <Mark value={row.live} />
                  </td>
                  <td className="p-4 lg:p-5">
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
