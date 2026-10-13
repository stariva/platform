import { audiences } from "../_data";

export function PartnersAudiences() {
  return (
    <section className="py-20 lg:py-28 bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Кому подходит
          </p>
          <h2
            className="font-serif text-near-black leading-[1.1] text-balance"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            Тем, кто создаёт образ и кадр
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {audiences.map((a) => (
            <article
              key={a.id}
              id={a.id}
              className="scroll-mt-24 flex flex-col rounded-2xl bg-white border border-espresso/6 p-7 lg:p-8"
            >
              <p className="label-caps text-terracotta text-[11px] mb-3">
                {a.label}
              </p>
              <h3 className="font-serif text-near-black text-2xl leading-snug mb-4">
                {a.title}
              </h3>
              <p className="text-dark-grey text-[14px] leading-relaxed mb-6">
                {a.body}
              </p>
              <ul className="mt-auto space-y-2 border-t border-espresso/8 pt-5">
                {a.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-[14px] text-espresso"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
