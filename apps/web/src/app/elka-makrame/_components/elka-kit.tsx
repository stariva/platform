import { ArrowUpRight, Check } from "lucide-react";
import Image from "next/image";
import { TrackedLink } from "@/components/stariva/tracked-link";
import type { Product } from "@/lib/catalog/types";
import { isPurchasable } from "@/lib/in-stock";
import { formatPrice, productHref } from "@/lib/products";

/** Набор с материалами и доступом к этому же мастер-классу. */
export function ElkaKit({ product }: { product?: Product }) {
  const image =
    product?.images[0] ??
    "https://cdn.stariva.ru/products/drafts/dcb56338e698d005.jpg";
  const href = product
    ? productHref(product)
    : "/catalog/interior/nabor-makrame-elka";

  return (
    <section aria-labelledby="elka-kit-title" className="bg-parchment">
      <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-12 lg:py-24">
        <div className="overflow-hidden rounded-[28px] border border-espresso/10 bg-white lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative aspect-[4/3] bg-linen lg:aspect-auto lg:min-h-[480px]">
            <Image
              src={image}
              alt="Набор для плетения ёлки макраме со шнуром и деревянными деталями"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <p className="label-caps mb-3 text-xs text-terracotta">
              Мастер-класс + материалы
            </p>
            <h2
              id="elka-kit-title"
              className="font-serif text-3xl leading-tight text-balance text-espresso lg:text-[42px]"
            >
              Хотите сразу начать плести? Возьмите готовый набор
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-dark-grey">
              Я уже собрала всё для вашей ёлки в одной коробке. Не придётся
              искать подходящий шнур и деревянные детали: откройте урок и
              плетите в своём темпе.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-espresso sm:text-base">
              {[
                "100 м хлопкового шнура для ёлки 50 × 110 см",
                "Деревянная основа, бусины и звезда",
                "Доступ к этому мастер-классу по QR-коду",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-sage"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-4 border-t border-espresso/10 pt-6 sm:flex-row sm:items-center">
              {product ? (
                <div className="shrink-0">
                  <span className="block text-sm text-text-grey">
                    Набор целиком
                  </span>
                  <span className="font-serif text-3xl text-espresso">
                    {formatPrice(product.price)}
                  </span>
                </div>
              ) : null}
              <TrackedLink
                href={href}
                goal="elka_kit_click"
                goalParams={{ slug: "nabor-makrame-elka" }}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-3 text-center font-medium text-parchment transition-colors hover:bg-terracotta-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                {product && isPurchasable(product)
                  ? "Купить набор"
                  : "Посмотреть набор"}
                <ArrowUpRight className="size-5 shrink-0" aria-hidden />
              </TrackedLink>
            </div>
            <p className="mt-3 text-sm text-text-grey">
              Мастер-класс уже входит в стоимость набора.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
