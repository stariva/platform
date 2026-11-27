import Image from "next/image";
import Link from "next/link";
import { NEW_YEAR_IMAGE, NEW_YEAR_PATH } from "@/lib/new-year";

export function NewYearTeaser() {
  return (
    <section
      className="mx-auto max-w-[1440px] px-5 py-12 lg:px-12"
      aria-labelledby="new-year-teaser-title"
    >
      <Link
        href={NEW_YEAR_PATH}
        className="group grid overflow-hidden rounded-2xl bg-sand focus-visible:outline-2 focus-visible:outline-offset-4 md:grid-cols-2"
      >
        <div className="relative min-h-64">
          <Image
            src={NEW_YEAR_IMAGE}
            alt="Коллекция ёлочных украшений в красных и молочных оттенках"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col justify-center gap-5 p-8 lg:p-12">
          <p className="text-xs uppercase tracking-[0.15em] text-taupe">
            Новогодняя коллекция
          </p>
          <h2
            id="new-year-teaser-title"
            className="font-serif text-4xl text-espresso lg:text-5xl"
          >
            Русская сказка
            <br />
            на вашей ёлке
          </h2>
          <p className="max-w-md text-taupe">
            Домики, снежинки и народные орнаменты. Девять фигурок, которые
            хочется рассматривать.
          </p>
          <span className="text-sm text-espresso underline underline-offset-4">
            Посмотреть украшения →
          </span>
        </div>
      </Link>
    </section>
  );
}
