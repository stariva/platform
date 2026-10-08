import Image from "next/image";
import { AUDIENCES } from "../_data";

export function ElkaAudiences() {
  const [featured, ...rest] = AUDIENCES;

  return (
    <section aria-labelledby="audiences-title" className="bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Кому подойдёт
          </p>
          <h2
            id="audiences-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Для дома и для бизнеса — одна ёлка, сотни сценариев
          </h2>
          <p className="text-dark-grey leading-relaxed">
            Ёлка из макраме уместна там, где живая ель неудобна, а искусственная
            выглядит дёшево: в небольшой квартире, детской, у стойки ресепшена
            или в зале ресторана.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {featured ? (
            <article className="group relative rounded-[28px] overflow-hidden min-h-[420px] lg:row-span-2 flex flex-col justify-end">
              <Image
                src={featured.image}
                alt={featured.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-near-black/75 via-near-black/10 to-transparent" />
              <div className="relative p-6 lg:p-10 max-w-lg">
                <h3 className="font-serif text-3xl text-white mb-3">
                  {featured.title}
                </h3>
                <p className="text-white/85 leading-relaxed">{featured.text}</p>
              </div>
            </article>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-6">
            {rest.map((item) => (
              <article
                key={item.title}
                className="rounded-[24px] bg-white overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-linen">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-xl text-espresso mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-dark-grey leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
