import Image from "next/image";
import Link from "next/link";
import { TrackedLink } from "@/components/stariva/tracked-link";
import { fetchPublishedWorkshops } from "@/lib/workshops/workshops-db";
import {
  categoryLabels,
  formatLessonsCount,
  formatPrice,
  formatReleaseDate,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";

/** Платные курсы первыми, бесплатный урок — в конце витрины. */
async function homeWorkshops() {
  const workshops = await fetchPublishedWorkshops();
  return [...workshops]
    .sort((a, b) => Number(a.price === 0) - Number(b.price === 0))
    .slice(0, 6);
}

/**
 * Полоса над первым экраном на телефоне: с главной иначе не видно, что
 * мастер-классы продаются. На десктопе они есть в шапке.
 */
export async function WorkshopsStrip() {
  const prices = (await homeWorkshops())
    .map((workshop) => workshop.price)
    .filter((price) => price > 0);
  if (prices.length === 0) return null;

  return (
    <TrackedLink
      href="/workshops"
      goal="home_workshops_strip"
      className="lg:hidden flex items-center justify-center gap-2 min-h-11 px-5 bg-espresso text-parchment text-[13px]"
    >
      Сплетите сами — видео-мастер-классы от {formatPrice(Math.min(...prices))}
      <span aria-hidden="true">↗</span>
    </TrackedLink>
  );
}

export async function WorkshopsTeaser() {
  const workshops = await homeWorkshops();
  if (workshops.length === 0) return null;

  return (
    <section
      id="workshops"
      aria-labelledby="home-workshops-title"
      className="scroll-mt-24 py-14 lg:py-24 border-b border-espresso/10"
    >
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        <p className="label-caps text-terracotta mb-4">Мастер-классы</p>
        <div className="flex flex-wrap justify-between items-end gap-5 mb-8">
          <div>
            <h2
              id="home-workshops-title"
              className="font-serif text-4xl lg:text-5xl leading-tight"
            >
              Сплетите сами
              <br />
              <span className="italic">по видеоурокам</span>
            </h2>
            <p className="mt-4 max-w-xl text-espresso/70 leading-relaxed">
              Ольга показывает каждый шаг — от первого узла до готовой работы.
              Оплачиваете один раз, уроки остаются в личном кабинете навсегда.
            </p>
          </div>
          <Link
            href="/workshops"
            className="py-2 text-sm underline underline-offset-4"
          >
            Все мастер-классы ↗
          </Link>
        </div>
        <ul className="-mx-5 px-5 scroll-px-5 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible lg:gap-8">
          {workshops.map((workshop) => (
            <li
              key={workshop.slug}
              className="w-[72%] shrink-0 snap-start md:w-auto"
            >
              <WorkshopCard workshop={workshop} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WorkshopCard({ workshop }: { workshop: Workshop }) {
  const preorder = isPreorder(workshop) && workshop.releaseAt;
  const meta = preorder
    ? `Предзаказ · старт ${formatReleaseDate(preorder)}`
    : [formatLessonsCount(workshop.lessonsCount), workshop.duration]
        .filter(Boolean)
        .join(" · ");

  return (
    <TrackedLink
      href={`/workshops/${workshop.slug}`}
      goal="home_workshop_card"
      goalParams={{ slug: workshop.slug }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-espresso/10 bg-parchment"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <Image
          src={workshop.cover}
          alt={workshop.title}
          fill
          sizes="(max-width: 768px) 72vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-parchment/90 text-[11px] label-caps text-espresso">
          {categoryLabels[workshop.category]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-xl text-espresso text-balance">
          {workshop.title}
        </h3>
        <p className="mt-2 flex-1 text-xs text-taupe">{meta}</p>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-serif text-2xl text-espresso">
            {formatPrice(workshop.price)}
          </span>
          {workshop.regularPrice ? (
            <s className="text-sm text-taupe">
              {formatPrice(workshop.regularPrice)}
            </s>
          ) : null}
        </p>
      </div>
    </TrackedLink>
  );
}
