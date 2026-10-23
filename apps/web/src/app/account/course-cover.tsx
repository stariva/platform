import Image from "next/image";
import Link from "next/link";

// Обложки бывают и горизонтальные 16:9, и вертикальные (ёлки 3:4, 2:3).
// На телефоне фото идёт во всю ширину в своих пропорциях (не выше 4:5), как в каталоге.
// С sm — колонка слева во всю высоту карточки: фото целиком по центру,
// поля заполняет его же размытая копия, чтобы ничего не обрезалось.
export function CourseCover({
  href,
  src,
  alt,
}: {
  href: string;
  src: string;
  alt: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block sm:w-56 lg:w-64 sm:min-h-52 bg-sand flex-shrink-0 overflow-hidden"
    >
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes="96px"
        className="hidden sm:block object-cover scale-110 blur-2xl opacity-80"
      />
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={675}
        sizes="(max-width: 640px) 100vw, 256px"
        className="w-full h-auto max-h-[125vw] object-cover object-top sm:absolute sm:inset-0 sm:h-full sm:max-h-none sm:object-contain sm:object-center transition-transform duration-300 group-hover:scale-105"
      />
    </Link>
  );
}
