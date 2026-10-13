import { formats } from "../_data";

export function PartnersFormats() {
  return (
    <section
      id="formats"
      className="scroll-mt-20 py-20 lg:py-28 bg-espresso text-parchment"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-parchment/60 text-[11px] mb-4">
            Форматы работы
          </p>
          <h2
            className="font-serif leading-[1.1] text-balance"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            Три способа работать вместе
          </h2>
          <p className="mt-5 text-parchment/65 leading-relaxed">
            Форматы можно совмещать: рекомендовать Stariva клиенткам, заказывать
            образы для своих съёмок и время от времени снимать совместные
            проекты.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-white/8 rounded-2xl overflow-hidden">
          {formats.map((f) => (
            <article key={f.number} className="bg-espresso p-8 lg:p-10">
              <div className="flex items-baseline justify-between gap-4 mb-6">
                <span
                  className="font-serif text-parchment/30 text-5xl leading-none select-none"
                  aria-hidden="true"
                >
                  {f.number}
                </span>
                <span className="label-caps text-parchment/50 text-[11px]">
                  {f.label}
                </span>
              </div>
              <h3 className="font-serif text-2xl mb-4">{f.title}</h3>
              <p className="text-parchment/70 text-[14px] leading-relaxed mb-6">
                {f.body}
              </p>
              <ul className="space-y-2.5">
                {f.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-[13px] text-parchment/85"
                  >
                    <CheckMark />
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

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-parchment/60"
    >
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
