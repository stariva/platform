import type { Product } from "@/lib/catalog/types";
import { AddPairButton } from "./add-pair-button";

const IDEAS = [
  {
    title: "Под новогоднюю ёлку или у камина",
    text: "Стильная, тёплая и долговечная замена штампованным пластиковым Дедам Морозам из супермаркета. Гномы уверенно стоят рядом с подарками и хвоей.",
  },
  {
    title: "На широкий подоконник",
    text: "Вечерние огоньки гирлянды на окне красиво подсвечивают бархатистую фактуру пряжи, а уютный силуэт гномов видно даже с улицы.",
  },
  {
    title: "В прихожей на комоде",
    text: "Поставьте пару у входа в дом — они будут первыми встречать вашу семью и гостей с мороза, с порога задавая тёплое настроение.",
  },
  {
    title: "Готовый душевный подарок",
    text: "Маме, близкой подруге или семье на новоселье и Новый год. Оба гнома приедут в красивой упаковке из крафта и льна — не нужно гадать с размерами и бегать по торговым центрам.",
  },
];

export function GnomesIdeas({
  available,
  label,
}: {
  available: Product[];
  label: string;
}) {
  return (
    <section aria-labelledby="gnomes-ideas-title" className="bg-sage-pale">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Идеи для дома
          </p>
          <h2
            id="gnomes-ideas-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Где гномы смотрятся лучше всего
          </h2>
          <p className="text-dark-grey leading-relaxed">
            Гном ростом 40–45 см — это заметная, статная фигура, которая не
            потеряется в комнате. Добавьте к ним пару еловых веток, шишки и
            тёплую гирлянду на Новый год, а после праздников не убирайте в
            коробку: они будут радовать глаз и согревать дом до самой весны.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {IDEAS.map((idea) => (
            <li key={idea.title} className="rounded-[20px] bg-white/80 p-6">
              <h3 className="font-serif text-lg text-espresso mb-2">
                {idea.title}
              </h3>
              <p className="text-sm leading-relaxed text-dark-grey">
                {idea.text}
              </p>
            </li>
          ))}
        </ul>

        <AddPairButton
          products={available}
          label={label}
          goal="gnomes_ideas_buy"
        />
      </div>
    </section>
  );
}
