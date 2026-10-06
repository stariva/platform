import Image from "next/image";
import Link from "next/link";

const scenes = [
  {
    label: "Марокко",
    image: "/images/photoshoots/morocco-riad.png",
    alt: "Марокканский риад с аркой и мозаикой — локация для фотосессии",
  },
  {
    label: "Свадьба у моря",
    image: "/images/photoshoots/wedding-sea.png",
    alt: "Свадебная арка на берегу моря на закате",
  },
  {
    label: "Пустыня",
    image: "/images/photoshoots/desert-road.png",
    alt: "Песчаные дюны в золотой час",
  },
];

export function PhotoshootsTeaser() {
  return (
    <section
      aria-labelledby="photoshoots-teaser-title"
      className="py-14 lg:py-24"
    >
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        <div className="flex flex-wrap justify-between items-end gap-5 mb-8">
          <div>
            <p className="label-caps text-terracotta mb-4">Фотосессии</p>
            <h2
              id="photoshoots-teaser-title"
              className="font-serif text-4xl lg:text-5xl leading-tight"
            >
              Образ для свадьбы
              <br />
              <span className="italic">и путешествия</span>
            </h2>
            <p className="mt-4 max-w-xl text-espresso/70 leading-relaxed">
              Марокко, море, пустыня, свадьба на побережье — подберём платье,
              тунику или накидку макраме под вашу локацию и сплетём к дате
              съёмки.
            </p>
          </div>
          <Link
            href="/photoshoots"
            className="rounded-full bg-espresso text-parchment px-6 py-3 text-sm"
          >
            Смотреть образы ↗
          </Link>
        </div>
        <ul className="flex gap-3 lg:gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 lg:mx-0 lg:px-0 pb-2">
          {scenes.map((scene) => (
            <li
              key={scene.label}
              className="snap-start shrink-0 basis-[78%] sm:basis-[45%] lg:basis-0 lg:flex-1"
            >
              <Link
                href="/photoshoots#scenarios"
                className="group relative block aspect-[4/5] overflow-hidden rounded-xl"
              >
                <Image
                  src={scene.image}
                  alt={scene.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, 78vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-espresso/70 via-transparent to-transparent" />
                <span className="absolute left-5 bottom-5 font-serif text-2xl text-parchment">
                  {scene.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
