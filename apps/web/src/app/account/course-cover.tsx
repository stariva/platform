import Image from "next/image";
import Link from "next/link";

// Обложки бывают и горизонтальные 16:9, и вертикальные (ёлки 3:4, 2:3).
// На телефоне фото идёт во всю ширину в своих пропорциях (не выше 4:5), как в каталоге.
// С sm карточки стоят сеткой, и фото заполняет единый вертикальный кадр 3:4 —
// в нём ёлки помещаются почти целиком, а горизонтальные обрезаются по центру.
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
      className="group relative block sm:aspect-[3/4] bg-sand overflow-hidden"
    >
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={675}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
        className="w-full h-auto max-h-[125vw] object-cover object-top sm:absolute sm:inset-0 sm:h-full sm:max-h-none sm:object-center transition-transform duration-500 group-hover:scale-105"
      />
    </Link>
  );
}
