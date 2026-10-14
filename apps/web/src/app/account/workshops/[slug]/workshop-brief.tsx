import Image from "next/image";
import type { WorkshopBrief as WorkshopBriefData } from "@/lib/workshops-data";

interface WorkshopBriefProps {
  title: string;
  materials: string[];
  brief: WorkshopBriefData;
}

/**
 * Бриф перед началом курса: что купить, где и как подготовиться.
 * Список материалов — из «Что понадобится», остальное — из брифа в админке.
 */
export function WorkshopBrief({ title, materials, brief }: WorkshopBriefProps) {
  const hasList = materials.length > 0;

  return (
    <section
      aria-labelledby="workshop-brief-title"
      className="bg-white border border-espresso/10 rounded-2xl p-6 sm:p-8 mb-6"
    >
      <p className="label-caps text-[11px] text-taupe mb-2">Перед началом</p>
      <h3
        id="workshop-brief-title"
        className="font-serif text-2xl sm:text-3xl text-espresso leading-tight mb-6"
      >
        Что понадобится
      </h3>

      <div
        className={
          brief.image
            ? "grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-8"
            : undefined
        }
      >
        <div className="min-w-0">
          {hasList && (
            <ol className="list-decimal pl-5 space-y-2.5 text-sm leading-relaxed text-espresso marker:text-taupe">
              {materials.map((item) => (
                <li key={item} className="pl-1">
                  {item}
                </li>
              ))}
            </ol>
          )}

          {brief.howTo && (
            <div
              className={
                hasList ? "mt-6 pt-5 border-t border-espresso/10" : undefined
              }
            >
              <p className="label-caps text-[11px] text-taupe mb-1.5">
                Как плести
              </p>
              <p className="text-sm leading-relaxed text-espresso/85 whitespace-pre-line">
                {brief.howTo}
              </p>
            </div>
          )}
        </div>

        {brief.image && (
          <div className="relative aspect-[3/4] w-full max-w-[260px] mx-auto sm:max-w-none overflow-hidden rounded-t-full rounded-b-xl bg-sand">
            <Image
              src={brief.image}
              unoptimized
              alt={`Готовая работа: ${title}`}
              fill
              sizes="(max-width: 640px) 260px, 220px"
              className="object-cover"
            />
          </div>
        )}
      </div>

      {brief.shops.length > 0 && (
        <div className="mt-7 rounded-xl bg-sand/60 border border-espresso/8 px-5 py-5 sm:px-6">
          <p className="font-serif italic text-2xl text-espresso leading-none mb-4">
            На заметку
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-espresso">
            {brief.shops.map((shop) => (
              <li key={shop.item}>
                <span className="font-medium">{shop.item}</span>
                {shop.note && (
                  <span className="text-espresso/75"> — {shop.note}</span>
                )}
                {shop.links.length > 0 && (
                  <span className="block mt-0.5">
                    {shop.links.map((link, index) => (
                      <span key={link.url}>
                        {index > 0 && <span className="text-taupe"> · </span>}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="underline decoration-espresso/30 underline-offset-[3px] hover:text-terracotta hover:decoration-terracotta transition-colors"
                        >
                          {link.label}
                          <span className="sr-only">
                            {" "}
                            (откроется в новой вкладке)
                          </span>
                        </a>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.outro && (
        <p className="mt-6 font-serif text-lg leading-snug text-espresso/90 whitespace-pre-line">
          {brief.outro}
        </p>
      )}
    </section>
  );
}
