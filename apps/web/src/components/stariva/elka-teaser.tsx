import Image from "next/image";
import { Suspense } from "react";
import { NewYearCountdown } from "@/components/stariva/new-year-countdown";
import { TrackedLink } from "@/components/stariva/tracked-link";
import {
  ORDER_DEADLINE_DAY,
  ORDER_DEADLINE_LABEL,
  TREES_PATH,
  treeDetails,
  WORKSHOP_PATH,
} from "@/lib/elka/data";
import { getTreeProducts } from "@/lib/elka/load";

const points = [
  "Не осыпается и не занимает места на полу",
  "Для квартиры, детской, отеля, кафе и офиса",
  "Плетётся под заказ, доставка по России",
];

export function ElkaTeaser() {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const month = Number(dateParts.find((part) => part.type === "month")?.value);
  const day = Number(dateParts.find((part) => part.type === "day")?.value);
  const deadlinePassed = month === 12 && day > ORDER_DEADLINE_DAY;

  return (
    <section
      aria-labelledby="elka-teaser-title"
      className="bg-sand py-14 lg:py-24"
    >
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-pale text-espresso px-4 py-2 text-sm mb-5">
            <span className="size-2 rounded-full bg-terracotta" aria-hidden />
            До Нового года <NewYearCountdown />
          </p>
          <h2
            id="elka-teaser-title"
            className="font-serif text-4xl lg:text-5xl leading-tight"
          >
            Новогодняя
            <br />
            <span className="italic">ёлка макраме на стену</span>
          </h2>
          <p className="mt-4 max-w-xl text-espresso/70 leading-relaxed">
            Вместо живой ели — панно ручной работы, которое служит годами.
            Выберите готовую ёлку или сплетите её сами дома по видеоурокам
            мастер-класса.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-espresso/80">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <TrackedLink
              href={TREES_PATH}
              goal="home_elka_models"
              className="inline-flex items-center justify-center rounded-full bg-espresso text-parchment px-6 py-3 text-sm"
            >
              Выбрать ёлку ↗
            </TrackedLink>
            <TrackedLink
              href={WORKSHOP_PATH}
              goal="home_elka_workshop"
              className="inline-flex items-center justify-center rounded-full border border-espresso/25 hover:border-espresso text-espresso px-6 py-3 text-sm transition-colors"
            >
              Мастер-класс со скидкой
            </TrackedLink>
          </div>
          <p className="mt-4 text-xs text-taupe">
            {deadlinePassed
              ? "Сроки изготовления и доставки уточняйте при заказе."
              : `Закажите до ${ORDER_DEADLINE_LABEL} — ёлка успеет к празднику.`}
          </p>
        </div>

        <Suspense fallback={<TeaserTreesSkeleton />}>
          <TeaserTrees />
        </Suspense>
      </div>
    </section>
  );
}

const TILE_OFFSET = "mt-8 lg:mt-12";

function TeaserTreesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:gap-5" aria-hidden>
      {[0, 1].map((index) => (
        <div
          key={index}
          className={`aspect-[4/5] rounded-xl bg-linen animate-pulse ${index === 1 ? TILE_OFFSET : ""}`}
        />
      ))}
    </div>
  );
}

/** Две первые ёлки из каталога; без каталога фото не показываем. */
async function TeaserTrees() {
  const trees = (await getTreeProducts()).products.slice(0, 2);
  if (trees.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 lg:gap-5">
      {trees.map((product, index) => {
        const image = product.images[0];
        const label = treeDetails(product);
        return (
          <li key={product.id} className={index === 1 ? TILE_OFFSET : ""}>
            <TrackedLink
              href={TREES_PATH}
              goal="home_elka_image"
              className="group relative block aspect-[4/5] overflow-hidden rounded-xl bg-linen"
            >
              {image ? (
                <Image
                  src={image}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1024px) 28vw, 45vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/60 via-transparent to-transparent" />
              <span className="absolute left-4 bottom-4 right-4 text-sm text-parchment">
                {label || product.name}
              </span>
            </TrackedLink>
          </li>
        );
      })}
    </ul>
  );
}
