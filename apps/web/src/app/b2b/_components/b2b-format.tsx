import { CheckIcon, XIcon } from "lucide-react";
import { WE_DO, WE_DONT } from "@/lib/b2b/terms";

/** Честный список: что входит в заказ и чего одна мастерица не берёт. */
export function B2BFormat() {
  return (
    <section className="py-28 lg:py-40 bg-sand">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-16 lg:mb-20 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="label-caps text-terracotta tracking-widest mb-4">
              Честно о формате
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
              Что делаю
              <br />
              <span className="text-taupe">и чего не делаю</span>
            </h2>
          </div>
          <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
            Всё плету я одна, поэтому беру заказы, которые могу сделать хорошо и
            в срок.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-espresso/8 border border-espresso/8 rounded-2xl overflow-hidden">
          <div className="bg-sand p-8 lg:p-10">
            <h3 className="font-serif text-2xl text-espresso mb-6">Делаю</h3>
            <ul className="space-y-4">
              {WE_DO.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-espresso/80 leading-relaxed"
                >
                  <CheckIcon
                    className="mt-1 size-4 shrink-0 text-terracotta"
                    strokeWidth={1.6}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-sand p-8 lg:p-10">
            <h3 className="font-serif text-2xl text-espresso mb-6">Не делаю</h3>
            <ul className="space-y-4">
              {WE_DONT.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-taupe leading-relaxed"
                >
                  <XIcon
                    className="mt-1 size-4 shrink-0 text-espresso/40"
                    strokeWidth={1.6}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
