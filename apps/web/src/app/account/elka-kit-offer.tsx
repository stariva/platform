import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog/types";
import { ELKA_KIT_OWNER_PRICE_KOPECKS } from "@/lib/commerce/elka-kit-price";
import { isPurchasable } from "@/lib/in-stock";
import { formatPrice, productHref } from "@/lib/products";
import { ElkaKitBuyButton } from "./elka-kit-buy-button";

export function ElkaKitOffer({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const price = Math.min(
    Math.round(product.price * 100),
    ELKA_KIT_OWNER_PRICE_KOPECKS,
  );
  const available = isPurchasable(product) && product.stockAvailable > 0;
  const hasImage = Boolean(product.images[0]);

  return (
    <section
      aria-label="Набор для участниц мастер-класса по ёлке"
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-terracotta/25 bg-white p-4"
          : "overflow-hidden rounded-2xl border border-terracotta/25 bg-white p-5 sm:p-6"
      }
    >
      <div
        className={
          hasImage
            ? "grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-x-6"
            : "grid gap-4"
        }
      >
        {product.images[0] ? (
          <div
            className={
              compact
                ? "relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand"
                : "relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:size-32"
            }
          >
            <Image
              src={product.images[0]}
              alt="Хлопковый шнур и деревянные детали набора для ёлки макраме"
              fill
              sizes={compact ? "80px" : "(min-width: 640px) 128px, 80px"}
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 self-center">
          <p className="label-caps mb-1 text-[11px] text-terracotta">
            Специально для участниц
          </p>
          <h2 className="font-serif text-xl leading-snug text-espresso sm:text-2xl">
            Набор для вашей ёлки — {formatPrice(price / 100)}
          </h2>
        </div>
        <div className={hasImage ? "col-span-2 sm:col-start-2" : ""}>
          <p className="text-sm leading-relaxed text-dark-grey">
            Мастер-класс у вас уже есть. В наборе — 110–120 м хлопкового шнура,
            уже нарезанного на отрезки, деревянная основа, бусины и звезда.
            {product.price * 100 > price
              ? ` Обычная цена — ${formatPrice(product.price)}.`
              : ""}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {available ? (
              <ElkaKitBuyButton product={product} />
            ) : (
              <p className="text-sm text-taupe">Сейчас нет в наличии</p>
            )}
            <Link
              href={productHref(product)}
              className="inline-flex min-h-11 items-center text-sm text-terracotta underline underline-offset-4 hover:text-terracotta-dark"
            >
              Что в наборе
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
