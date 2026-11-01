import type { Product } from "@/lib/catalog/types";
import { AddPairButton } from "./add-pair-button";

const IDEAS = [
  {
    title: "Каминная полка или консоль",
    text: "Самое очевидное место: гномы на разной высоте, вокруг — шишки, еловые ветки, свеча и гирлянда.",
  },
  {
    title: "Подоконник",
    text: "Огни гирлянды на окне красиво подсвечивают фактуру пряжи, а гномов видно и с улицы.",
  },
  {
    title: "Прихожая",
    text: "Комод у входа встречает гостей первым и сразу задаёт настроение всему дому.",
  },
  {
    title: "Подарок",
    text: "К Новому году — коллеге, подруге или маме: два гнома в одной упаковке — готовая композиция, размеры и вкусы знать не нужно.",
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
          <p className="label-caps text-terracotta text-[11px] mb-4">Идеи</p>
          <h2
            id="gnomes-ideas-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Куда поставить гномов
          </h2>
          <p className="text-dark-grey leading-relaxed">
            Гном ростом 40–45 см — уже предмет интерьера, а не мелочь. К Новому
            году его не нужно ничем заменять: добавьте еловые ветки, гирлянду и
            свечи — гном станет частью праздничной композиции, а в январе
            останется в доме и без гирлянды.
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
